import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Polished for clean loading and consistent module resolution

// GET: evaluations for a visit
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");
    const id = searchParams.get("id");

    if (id) {
      const [evalRow] = await sql`
        SELECT * FROM visit_calculator_evaluations WHERE id = ${parseInt(id)}
      `;
      if (!evalRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const cats = await sql`
        SELECT * FROM visit_calculator_categories WHERE evaluation_id = ${parseInt(id)} ORDER BY id
      `;
      return NextResponse.json({ ...evalRow, categories: cats });
    }

    if (!visitId) return NextResponse.json([]);

    const evals = await sql`
      SELECT * FROM visit_calculator_evaluations 
      WHERE visit_id = ${parseInt(visitId)} 
      ORDER BY version DESC, created_at DESC
    `;

    // attach categories and mark confirmed
    const result = [];
    for (const e of evals) {
      const cats = await sql`SELECT * FROM visit_calculator_categories WHERE evaluation_id = ${e.id} ORDER BY id`;
      result.push({ ...e, categories: cats });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("calculator GET error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: create new evaluation (draft or full)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      visit_id,
      responsible,
      evaluation_date,
      est_kg_cut,
      calculation_base,
      sample_total_kg,
      observations,
      evidence,
      categories // array of {category_type, name, sample_kg, projected_percent, projected_kg}
    } = body;

    if (!visit_id) return NextResponse.json({ error: "visit_id required" }, { status: 400 });

    // Get next version
    const [last] = await sql`
      SELECT COALESCE(MAX(version), 0) as maxv FROM visit_calculator_evaluations WHERE visit_id = ${parseInt(visit_id)}
    `;
    const nextVersion = (last?.maxv || 0) + 1;

    const [ev] = await sql`
      INSERT INTO visit_calculator_evaluations (
        visit_id, version, responsible, evaluation_date, est_kg_cut, calculation_base,
        sample_total_kg, observations, evidence, is_confirmed
      ) VALUES (
        ${parseInt(visit_id)}, ${nextVersion}, ${responsible || ''}, ${evaluation_date || new Date().toISOString().slice(0,10)},
        ${parseFloat(est_kg_cut) || 0}, ${calculation_base || 'sample_weight'},
        ${parseFloat(sample_total_kg) || 0}, ${observations || ''}, ${JSON.stringify(evidence || [])}, false
      ) RETURNING *
    `;

    if (Array.isArray(categories) && categories.length) {
      for (const c of categories) {
        await sql`
          INSERT INTO visit_calculator_categories (
            evaluation_id, category_type, name, sample_kg, projected_percent, projected_kg
          ) VALUES (
            ${ev.id}, ${c.category_type || 'caliber'}, ${c.name}, ${parseFloat(c.sample_kg)||0},
            ${parseFloat(c.projected_percent)||0}, ${parseFloat(c.projected_kg)||0}
          )
        `;
      }
    }

    // Audit
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, description, timestamp)
      VALUES ('acopiador', ${responsible || 'acopiador'}, 'acopios', 'CALCULATOR_CREATE', 'visit_calculator', ${ev.id}, ${'Calc version ' + nextVersion}, NOW())
    `;

    return NextResponse.json({ success: true, evaluation: ev });
  } catch (e) {
    console.error("calculator POST error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: update (incl confirm) or set confirmed (version lock)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, is_confirmed, categories, ...fields } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [updated] = await sql`
      UPDATE visit_calculator_evaluations SET
        est_kg_cut = COALESCE(${fields.est_kg_cut !== undefined ? parseFloat(fields.est_kg_cut) : null}, est_kg_cut),
        calculation_base = COALESCE(${fields.calculation_base}, calculation_base),
        sample_total_kg = COALESCE(${fields.sample_total_kg !== undefined ? parseFloat(fields.sample_total_kg) : null}, sample_total_kg),
        observations = COALESCE(${fields.observations}, observations),
        evidence = COALESCE(${fields.evidence ? JSON.stringify(fields.evidence) : null}, evidence),
        is_confirmed = COALESCE(${is_confirmed !== undefined ? !!is_confirmed : null}, is_confirmed),
        updated_at = NOW()
      WHERE id = ${parseInt(id)} RETURNING *
    `;

    if (Array.isArray(categories)) {
      await sql`DELETE FROM visit_calculator_categories WHERE evaluation_id = ${parseInt(id)}`;
      for (const c of categories) {
        await sql`
          INSERT INTO visit_calculator_categories (evaluation_id, category_type, name, sample_kg, projected_percent, projected_kg)
          VALUES (${parseInt(id)}, ${c.category_type||'caliber'}, ${c.name}, ${parseFloat(c.sample_kg)||0}, ${parseFloat(c.projected_percent)||0}, ${parseFloat(c.projected_kg)||0})
        `;
      }
    }

    // If confirming, unconfirm previous versions for this visit (keep history)
    if (is_confirmed === true && updated) {
      await sql`
        UPDATE visit_calculator_evaluations 
        SET is_confirmed = false 
        WHERE visit_id = ${updated.visit_id} AND id <> ${updated.id}
      `;
    }

    return NextResponse.json({ success: true, evaluation: updated });
  } catch (e) {
    console.error("calculator PUT error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}