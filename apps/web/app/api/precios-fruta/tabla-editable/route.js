import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM precios_fruta_tabla_editable WHERE id = 1 LIMIT 1`;
    const row = rows[0];
    return NextResponse.json({ cells: (row && row.cells) || {} });
  } catch (e) {
    return NextResponse.json({ cells: {} }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    let incoming = body.cells || {};
    const curr = await sql`SELECT cells FROM precios_fruta_tabla_editable WHERE id = 1 LIMIT 1`;
    const base = (curr[0] && curr[0].cells) || {};
    const merged = { ...base, ...incoming };
    await sql`
      INSERT INTO precios_fruta_tabla_editable (id, cells, updated_at)
      VALUES (1, ${merged}, NOW())
      ON CONFLICT (id) DO UPDATE SET cells = ${merged}, updated_at = NOW()
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e.message || e) }, { status: 500 });
  }
}
