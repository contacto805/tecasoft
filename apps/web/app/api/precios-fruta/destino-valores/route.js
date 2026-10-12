import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destinoId = searchParams.get("destino_id");
    if (!destinoId) return NextResponse.json([]);
    const rows = await sql`
      SELECT v.*, c.nombre, c.categoria, c.tipo_calculo 
      FROM destino_costos_valores v 
      LEFT JOIN costo_conceptos c ON c.id = v.concepto_id 
      WHERE v.destino_id = ${parseInt(destinoId)} AND v.activo = true
    `;
    return NextResponse.json(rows);
  } catch (e) { return NextResponse.json([]); }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { destino_id, valores } = body; // valores = array of {concepto_id, cantidad, precio_unitario, ...}
    if (!destino_id || !Array.isArray(valores)) return NextResponse.json({ error: "datos invalidos" }, { status: 400 });

    // deactivate old
    await sql`UPDATE destino_costos_valores SET activo=false WHERE destino_id=${parseInt(destino_id)}`;

    for (const v of valores) {
      await sql`
        INSERT INTO destino_costos_valores (destino_id, concepto_id, cantidad, precio_unitario, moneda, vigente_desde, activo)
        VALUES (${parseInt(destino_id)}, ${parseInt(v.concepto_id)}, ${Number(v.cantidad)||0}, ${Number(v.precio_unitario)||0}, 'MXN', CURRENT_DATE, true)
      `;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}