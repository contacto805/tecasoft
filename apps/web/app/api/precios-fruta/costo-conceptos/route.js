import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM costo_conceptos WHERE activo = true ORDER BY orden ASC, id ASC`;
    return NextResponse.json(rows || []);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const c = await request.json();
    const [row] = await sql`
      INSERT INTO costo_conceptos (nombre, categoria, tipo_calculo, unidad, moneda, precio_unitario, orden, activo)
      VALUES (${c.nombre}, ${c.categoria}, ${c.tipo_calculo}, ${c.unidad}, ${c.moneda || 'MXN'}, ${parseFloat(c.precio_unitario)||0}, ${parseInt(c.orden)||0}, true)
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, ...c } = await request.json();
    const [row] = await sql`
      UPDATE costo_conceptos SET 
        nombre=${c.nombre}, categoria=${c.categoria}, tipo_calculo=${c.tipo_calculo},
        unidad=${c.unidad}, moneda=${c.moneda}, precio_unitario=${parseFloat(c.precio_unitario)||0},
        orden=${parseInt(c.orden)||0}, updated_at=NOW()
      WHERE id=${id} RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}