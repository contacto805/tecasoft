import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  const cuttingId = searchParams.get("cuttingOrderId");
  try {
    let where = sql`WHERE 1=1`;
    if (lotId) where = sql`${where} AND lot_id = ${parseInt(lotId)}`;
    if (cuttingId) where = sql`${where} AND cutting_order_id = ${parseInt(cuttingId)}`;
    const rows = await sql`SELECT * FROM inocuidad_inspections ${where} ORDER BY inspection_date DESC LIMIT 50`;
    return NextResponse.json(rows);
  } catch (e) { return NextResponse.json([]); }
}

export async function POST(request) {
  try {
    const b = await request.json();
    // Inspection linked by ref (lot/cutting/area) - reuses official criteria
    const [ins] = await sql`
      INSERT INTO inocuidad_inspections (criteria_id, lot_id, cutting_order_id, area, inspection_date, responsible, status, notes, user_id, user_name)
      VALUES (${b.criteria_id || null}, ${b.lot_id || null}, ${b.cutting_order_id || null}, ${b.area || ''}, ${b.inspection_date || new Date().toISOString().slice(0,10)}, ${b.responsible || ''}, ${b.status || 'pendiente'}, ${b.notes || ''}, ${b.user_id || ''}, ${b.user_name || ''})
      RETURNING *
    `;
    return NextResponse.json(ins);
  } catch (e) {
    return NextResponse.json({ error: "No se pudo registrar inspección" }, { status: 500 });
  }
}
