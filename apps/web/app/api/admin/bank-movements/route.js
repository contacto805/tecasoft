import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statementId = searchParams.get("statementId");
    const status = searchParams.get("status");

    let q = sql`SELECT bm.*, bs.bank_name, bs.period_start, bs.period_end FROM bank_movements bm LEFT JOIN bank_statements bs ON bm.statement_id = bs.id`;
    const conds = [];
    if (statementId) conds.push(sql`bm.statement_id = ${parseInt(statementId)}`);
    if (status) conds.push(sql`bm.status = ${status}`);

    if (conds.length) {
      q = sql`${q} WHERE ${conds[0]}`;
      for (let i = 1; i < conds.length; i++) q = sql`${q} AND ${conds[i]}`;
    }
    q = sql`${q} ORDER BY bm.movement_date ASC, bm.id ASC LIMIT 500`;

    const rows = await sql`${q}`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { statement_id, movements } = data; // array of movement objects

    if (!statement_id || !Array.isArray(movements)) {
      return NextResponse.json({ error: "statement_id y movements[] requeridos" }, { status: 400 });
    }

    const inserted = [];
    for (const m of movements) {
      const [row] = await sql`
        INSERT INTO bank_movements (
          statement_id, movement_date, description, reference, beneficiary, payer,
          charge, credit, amount, currency, account, clabe, bank_identifier, concept, status
        ) VALUES (
          ${parseInt(statement_id)}, ${m.movement_date}, ${m.description || null}, ${m.reference || null},
          ${m.beneficiary || null}, ${m.payer || null},
          ${parseFloat(m.charge) || 0}, ${parseFloat(m.credit) || 0}, ${parseFloat(m.amount) || 0},
          ${m.currency || 'MXN'}, ${m.account || null}, ${m.clabe || null},
          ${m.bank_identifier || null}, ${m.concept || null}, 'sin_analizar'
        ) RETURNING *
      `;
      inserted.push(row);
    }

    // Mark statement as analyzed if it had rows
    if (inserted.length) {
      await sql`UPDATE bank_statements SET status = 'clasificacion_sugerida', updated_at = NOW() WHERE id = ${parseInt(statement_id)}`;
    }

    return NextResponse.json({ inserted: inserted.length, movements: inserted });
  } catch (e) {
    return NextResponse.json({ error: "Error al guardar movimientos" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...update } = data;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM bank_movements WHERE id = ${parseInt(id)}`;
    if (!current) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    const [updated] = await sql`
      UPDATE bank_movements SET
        status = ${update.status !== undefined ? update.status : current.status},
        suggested_entity_type = ${update.suggested_entity_type !== undefined ? update.suggested_entity_type : current.suggested_entity_type},
        suggested_entity_id = ${update.suggested_entity_id !== undefined ? update.suggested_entity_id : current.suggested_entity_id},
        suggested_document_type = ${update.suggested_document_type !== undefined ? update.suggested_document_type : current.suggested_document_type},
        suggested_document_id = ${update.suggested_document_id !== undefined ? update.suggested_document_id : current.suggested_document_id},
        category = ${update.category !== undefined ? update.category : current.category},
        confidence = ${update.confidence !== undefined ? parseFloat(update.confidence) : current.confidence},
        classification_reason = ${update.classification_reason !== undefined ? update.classification_reason : current.classification_reason},
        reconciled_by = ${update.reconciled_by !== undefined ? update.reconciled_by : current.reconciled_by},
        reconciled_at = ${update.status === 'conciliado' ? 'NOW()' : current.reconciled_at},
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Audit
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, description)
      VALUES ('admin', ${update.reconciled_by || 'admin'}, 'conciliacion_bancaria', 'update', 'bank_movement', ${id}, 'Movimiento actualizado / conciliado')
    `;

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar movimiento" }, { status: 500 });
  }
}