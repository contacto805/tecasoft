import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM marcas_etiquetas WHERE activo = true ORDER BY nombre`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const b = await request.json();
    const [row] = await sql`
      INSERT INTO marcas_etiquetas (nombre, costo_regalia_por_caja_usd) 
      VALUES (${b.nombre}, ${parseFloat(b.costo_regalia_por_caja_usd)||0}) RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
