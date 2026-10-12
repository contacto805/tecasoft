import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getMexicoCityTime } from "@/app/api/utils/mexico-time";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const producer = searchParams.get('producer');
    const broker = searchParams.get('broker');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');

    let where = sql``;
    if (producer) where = sql`${where} AND v.producer ILIKE ${'%'+producer+'%'}`;
    if (broker) where = sql`${where} AND v.broker ILIKE ${'%'+broker+'%'}`;
    if (from) where = sql`${where} AND v.visit_date >= ${from}`;
    if (to) where = sql`${where} AND v.visit_date <= ${to}`;

    const visits = await sql`
      SELECT v.*, 
        n.id as neg_id, n.status as neg_status, n.offered_price, n.pact_price, 
        n.purchase_type, n.payment_form, n.tentative_cut_date, n.observations as neg_obs
      FROM orchard_visits v
      LEFT JOIN negotiations n ON n.visit_id = v.id
      WHERE 1=1 ${where}
      ORDER BY v.visit_date DESC, v.visit_time DESC 
      LIMIT 100
    `;

    // attach photos and flowers
    const visitIds = visits.map(v => v.id);
    let photos = [];
    let flowers = [];
    if (visitIds.length) {
      [photos, flowers] = await Promise.all([
        sql`SELECT * FROM visit_photos WHERE visit_id = ANY(${visitIds}) ORDER BY id`,
        sql`SELECT * FROM flower_records WHERE visit_id = ANY(${visitIds}) ORDER BY id`
      ]);
    }
    const photosByVisit = photos.reduce((acc, p) => { (acc[p.visit_id] ||= []).push(p); return acc; }, {});
    const flByVisit = flowers.reduce((acc, f) => { (acc[f.visit_id] ||= []).push(f); return acc; }, {});

    const result = visits.map(v => ({
      ...v,
      photos: photosByVisit[v.id] || [],
      flowers: flByVisit[v.id] || [],
      negotiation: v.neg_id ? {
        id: v.neg_id,
        status: v.neg_status,
        offered_price: v.offered_price,
        pact_price: v.pact_price,
        purchase_type: v.purchase_type,
        payment_form: v.payment_form,
        tentative_cut_date: v.tentative_cut_date,
        observations: v.neg_obs
      } : null
    }));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const v = data.visit || data;
    const mx = getMexicoCityTime();

    // Validate percent sum ~100 (consistent tolerance with UI: <=1.0)
    const calPer = [
      +(v.super_percent || 0), +(v.extra_percent || 0), +(v.primera_percent || 0), +(v.mediano_percent || 0),
      +(v.tercera_percent || 0), +(v.cuarta_percent || 0), +(v.canica_percent || 0), +(v.clase2_percent || 0),
      +(v.proceso_percent || 0), +(v.desecho_percent || 0)
    ];
    const sum = calPer.reduce((a,b)=>a+b, 0);
    if (Math.abs(sum - 100) > 1.0) {
      return NextResponse.json({ error: "La sumatoria de calibres debe ser ~100% (tolerancia 1%)" }, { status: 400 });
    }
    if (!v.orchard_name) return NextResponse.json({ error: "Nombre de huerta requerido" }, { status: 400 });

    const [visit] = await sql`
      INSERT INTO orchard_visits (
        visit_date, visit_time, user_id, acopiador, device,
        orchard_name, producer, broker, municipality, locality, state,
        lat, lng, alt, precision_m,
        super_percent, extra_percent, primera_percent, mediano_percent, tercera_percent, cuarta_percent,
        canica_percent, clase2_percent, proceso_percent, desecho_percent,
        trees_productive, young_trees, hectares, est_kg, est_ton, observations
      ) VALUES (
        ${mx.date || v.visit_date},
        ${mx.time.slice(0,5) || v.visit_time},
        ${v.user_id || 'acopiador'},
        ${v.acopiador || ''},
        ${v.device || 'Web'},
        ${v.orchard_name}, ${v.producer || ''}, ${v.broker || ''},
        ${v.municipality || ''}, ${v.locality || ''}, ${v.state || ''},
        ${v.lat || null}, ${v.lng || null}, ${v.alt || null}, ${v.precision_m || null},
        ${v.super_percent || 0}, ${v.extra_percent || 0}, ${v.primera_percent || 0},
        ${v.mediano_percent || 0}, ${v.tercera_percent || 0}, ${v.cuarta_percent || 0},
        ${v.canica_percent || 0}, ${v.clase2_percent || 0}, ${v.proceso_percent || 0},
        ${v.desecho_percent || 0},
        ${v.trees_productive || 0}, ${v.young_trees || 0}, ${v.hectares || 0},
        ${v.est_kg || 0}, ${v.est_ton || 0}, ${v.observations || ''}
      ) RETURNING *
    `;

    // Save negotiation if provided
    if (data.negotiation && data.negotiation.status) {
      const n = data.negotiation;
      await sql`
        INSERT INTO negotiations (visit_id, status, offered_price, pact_price, purchase_type, payment_form, tentative_cut_date, observations)
        VALUES (${visit.id}, ${n.status || 'Prospecto'}, ${n.offered_price || null}, ${n.pact_price || null},
                ${n.purchase_type || null}, ${n.payment_form || null}, ${n.tentative_cut_date || null}, ${n.observations || ''})
      `;
    }

    // Photos
    const userName = v.acopiador || v.user_id || 'acopiador';
    if (Array.isArray(data.photos) && data.photos.length) {
      for (const p of data.photos) {
        if (p.photo_url) {
          await sql`
            INSERT INTO visit_photos (visit_id, photo_url, photo_type, captured_at, user_name, gps_lat, gps_lng)
            VALUES (${visit.id}, ${p.photo_url}, ${p.photo_type || 'general'}, ${new Date().toISOString()},
            ${userName}, ${v.lat || null}, ${v.lng || null})
          `;
        }
      }
    }

    // Flowers
    if (Array.isArray(data.flowers) && data.flowers.length) {
      for (const f of data.flowers) {
        await sql`
          INSERT INTO flower_records (visit_id, flower_type, est_cut_date, real_cut_date, expected_kg, real_kg, notes)
          VALUES (${visit.id}, ${f.flower_type || 'Principal'}, ${f.est_cut_date || null}, ${f.real_cut_date || null},
                  ${f.expected_kg || null}, ${f.real_kg || null}, ${f.notes || ''})
        `;
      }
    }

    // Audit
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, description, timestamp)
      VALUES (${v.user_id || 'acopiador'}, ${v.acopiador || 'ACOPIADOR'}, 'acopios', 'CREATE',
              'orchard_visit', ${visit.id}, ${'Visita a ' + (v.orchard_name||'')}, NOW())
    `;

    return NextResponse.json({ success: true, visit_id: visit.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    // Validate percents if any provided (consistent tolerance)
    const p = fields;
    if (p.super_percent !== undefined || p.extra_percent !== undefined || p.proceso_percent !== undefined) {
      const calPer = [
        +(p.super_percent ?? 0), +(p.extra_percent ?? 0), +(p.primera_percent ?? 0), +(p.mediano_percent ?? 0),
        +(p.tercera_percent ?? 0), +(p.cuarta_percent ?? 0), +(p.canica_percent ?? 0), +(p.clase2_percent ?? 0),
        +(p.proceso_percent ?? 0), +(p.desecho_percent ?? 0)
      ];
      const sum = calPer.reduce((a,b)=>a+b, 0);
      if (Math.abs(sum - 100) > 1.0) {
        return NextResponse.json({ error: 'La sumatoria de calibres debe ser ~100% (tolerancia 1%)' }, { status: 400 });
      }
    }

    const [vis] = await sql`
      UPDATE orchard_visits SET
        orchard_name = COALESCE(${fields.orchard_name}, orchard_name),
        producer = COALESCE(${fields.producer}, producer),
        broker = COALESCE(${fields.broker}, broker),
        lat = COALESCE(${fields.lat}, lat),
        lng = COALESCE(${fields.lng}, lng),
        observations = COALESCE(${fields.observations}, observations),
        super_percent = COALESCE(${fields.super_percent !== undefined ? parseFloat(fields.super_percent) : null}, super_percent),
        extra_percent = COALESCE(${fields.extra_percent !== undefined ? parseFloat(fields.extra_percent) : null}, extra_percent),
        primera_percent = COALESCE(${fields.primera_percent !== undefined ? parseFloat(fields.primera_percent) : null}, primera_percent),
        mediano_percent = COALESCE(${fields.mediano_percent !== undefined ? parseFloat(fields.mediano_percent) : null}, mediano_percent),
        tercera_percent = COALESCE(${fields.tercera_percent !== undefined ? parseFloat(fields.tercera_percent) : null}, tercera_percent),
        cuarta_percent = COALESCE(${fields.cuarta_percent !== undefined ? parseFloat(fields.cuarta_percent) : null}, cuarta_percent),
        canica_percent = COALESCE(${fields.canica_percent !== undefined ? parseFloat(fields.canica_percent) : null}, canica_percent),
        clase2_percent = COALESCE(${fields.clase2_percent !== undefined ? parseFloat(fields.clase2_percent) : null}, clase2_percent),
        proceso_percent = COALESCE(${fields.proceso_percent !== undefined ? parseFloat(fields.proceso_percent) : null}, proceso_percent),
        desecho_percent = COALESCE(${fields.desecho_percent !== undefined ? parseFloat(fields.desecho_percent) : null}, desecho_percent),
        est_kg = COALESCE(${fields.est_kg !== undefined ? parseFloat(fields.est_kg) : null}, est_kg),
        updated_at = NOW()
      WHERE id = ${parseInt(id)} RETURNING *
    `;

    if (fields.negotiation) {
      const n = fields.negotiation;
      // upsert negotiation
      const existingN = await sql`SELECT id FROM negotiations WHERE visit_id = ${parseInt(id)} LIMIT 1`;
      if (existingN.length) {
        await sql`
          UPDATE negotiations SET 
            status = COALESCE(${n.status}, status),
            pact_price = COALESCE(${n.pact_price}, pact_price),
            offered_price = COALESCE(${n.offered_price}, offered_price),
            purchase_type = COALESCE(${n.purchase_type}, purchase_type),
            payment_form = COALESCE(${n.payment_form}, payment_form),
            tentative_cut_date = COALESCE(${n.tentative_cut_date}, tentative_cut_date),
            observations = COALESCE(${n.observations}, observations),
            updated_at = NOW()
          WHERE visit_id = ${parseInt(id)}
        `;
      } else if (n.status) {
        await sql`
          INSERT INTO negotiations (visit_id, status, offered_price, pact_price, purchase_type, payment_form, tentative_cut_date, observations)
          VALUES (${parseInt(id)}, ${n.status || 'Prospecto'}, ${n.offered_price || null}, ${n.pact_price || null},
                  ${n.purchase_type || null}, ${n.payment_form || null}, ${n.tentative_cut_date || null}, ${n.observations || ''})
        `;
      }
    }

    // If calculator data provided on visit update, create or update draft evaluation (optional)
    if (fields.calculator && fields.calculator.categories) {
      // create new version via calculator endpoint logic (simple inline)
      const c = fields.calculator;
      const [lastV] = await sql`SELECT COALESCE(MAX(version),0) as mv FROM visit_calculator_evaluations WHERE visit_id=${parseInt(id)}`;
      const nv = (lastV?.mv || 0) + 1;
      const [newEval] = await sql`
        INSERT INTO visit_calculator_evaluations (visit_id, version, responsible, evaluation_date, est_kg_cut, calculation_base, sample_total_kg, observations, is_confirmed)
        VALUES (${parseInt(id)}, ${nv}, ${c.responsible||''}, ${c.evaluation_date || new Date().toISOString().slice(0,10)}, ${parseFloat(c.est_kg_cut)||0}, ${c.calculation_base||'sample_weight'}, ${parseFloat(c.sample_total_kg)||0}, ${c.observations||''}, false)
        RETURNING *
      `;
      if (Array.isArray(c.categories)) {
        for (const cat of c.categories) {
          await sql`INSERT INTO visit_calculator_categories (evaluation_id, category_type, name, sample_kg, projected_percent, projected_kg) VALUES (${newEval.id}, ${cat.category_type||'caliber'}, ${cat.name}, ${parseFloat(cat.sample_kg)||0}, ${parseFloat(cat.projected_percent)||0}, ${parseFloat(cat.projected_kg)||0})`;
        }
      }
    }

    return NextResponse.json({ success: true, visit: vis });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
