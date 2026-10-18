import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, folio, change_type as tipo, module, description as motivo, status, requested_by, requested_at
      FROM pending_changes 
      ORDER BY requested_at DESC LIMIT 20
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const { tipo, motivo, entidad, requested_by } = await request.json();
    const folio = 'PROP-' + Date.now().toString().slice(-8);
    await sql`
      INSERT INTO pending_changes (change_type, module, table_name, record_id, description, requested_by, requested_at, status)
      VALUES (${tipo || 'ajuste_ia'}, 'teca-vo-ia', 'financial_or_system', ${entidad ? parseInt(entidad) : null}, ${motivo || 'Propuesta generada por IA'}, ${requested_by || 'ia'}, NOW(), 'pendiente')
    `;
    return NextResponse.json({ success: true, folio });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e.message || e) });
  }
}
