import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT rows FROM precios_fruta_costos_detalle WHERE id = 1 LIMIT 1`;
    const data = rows[0];
    return NextResponse.json({ rows: (data && data.rows) || [] });
  } catch (e) {
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.rows) ? body.rows : [];
    await sql`
      INSERT INTO precios_fruta_costos_detalle (id, rows, updated_at) 
      VALUES (1, ${items}, NOW())
      ON CONFLICT (id) DO UPDATE SET rows = ${items}, updated_at = NOW()
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e.message || e) }, { status: 500 });
  }
}