import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");

    if (id) {
      const [stmt] = await sql`SELECT * FROM bank_statements WHERE id = ${parseInt(id)}`;
      if (!stmt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

      const movements = await sql`
        SELECT * FROM bank_movements 
        WHERE statement_id = ${parseInt(id)} 
        ORDER BY movement_date ASC, id ASC
      `;
      return NextResponse.json({ ...stmt, movements });
    }

    let where = sql``;
    if (status) where = sql`WHERE status = ${status}`;

    const stmts = await sql`
      SELECT bs.*, 
             (SELECT COUNT(*) FROM bank_movements bm WHERE bm.statement_id = bs.id) as movement_count,
             (SELECT COUNT(*) FROM bank_movements bm WHERE bm.statement_id = bs.id AND bm.status = 'conciliado') as reconciled_count
      FROM bank_statements bs 
      ${where}
      ORDER BY created_at DESC 
      LIMIT 100
    `;
    return NextResponse.json(stmts);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener estados de cuenta" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      bank_name, account_number, currency, period_start, period_end,
      saldo_inicial, saldo_final, titular, empresa, file_url, file_hash, file_name, imported_by
    } = data;

    if (!bank_name || !period_start) {
      return NextResponse.json({ error: "Banco y periodo requeridos" }, { status: 400 });
    }

    // Detect repeated import by hash
    if (file_hash) {
      const dup = await sql`SELECT id FROM bank_statements WHERE file_hash = ${file_hash} LIMIT 1`;
      if (dup.length) {
        return NextResponse.json({ error: "Importación repetida detectada", existing_id: dup[0].id }, { status: 409 });
      }
    }

    const [row] = await sql`
      INSERT INTO bank_statements (
        bank_name, account_number, currency, period_start, period_end,
        saldo_inicial, saldo_final, titular, empresa, file_url, file_hash, file_name, imported_by, status
      ) VALUES (
        ${bank_name}, ${account_number || null}, ${currency || 'MXN'},
        ${period_start}, ${period_end || null},
        ${parseFloat(saldo_inicial) || 0}, ${parseFloat(saldo_final) || 0},
        ${titular || null}, ${empresa || null},
        ${file_url || null}, ${file_hash || null}, ${file_name || null},
        ${imported_by || 'admin'}, 'sin_analizar'
      ) RETURNING *
    `;

    // Audit
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, description)
      VALUES (${imported_by || 'admin'}, ${imported_by || 'admin'}, 'conciliacion_bancaria', 'upload', 'bank_statement', ${row.id}, 'Estado bancario subido')
    `;

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear estado" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...update } = data;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM bank_statements WHERE id = ${parseInt(id)}`;
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const [updated] = await sql`
      UPDATE bank_statements SET
        bank_name = ${update.bank_name !== undefined ? update.bank_name : current.bank_name},
        account_number = ${update.account_number !== undefined ? update.account_number : current.account_number},
        currency = ${update.currency !== undefined ? update.currency : current.currency},
        period_start = ${update.period_start !== undefined ? update.period_start : current.period_start},
        period_end = ${update.period_end !== undefined ? update.period_end : current.period_end},
        saldo_inicial = ${update.saldo_inicial !== undefined ? parseFloat(update.saldo_inicial) : current.saldo_inicial},
        saldo_final = ${update.saldo_final !== undefined ? parseFloat(update.saldo_final) : current.saldo_final},
        status = ${update.status !== undefined ? update.status : current.status},
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}