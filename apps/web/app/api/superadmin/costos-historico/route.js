import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destino = searchParams.get("destino");
    
    let query;
    if (destino) {
      query = sql`SELECT * FROM destino_costos_historico WHERE destino = ${destino} ORDER BY fecha DESC LIMIT 20`;
    } else {
      query = sql`SELECT * FROM destino_costos_historico ORDER BY fecha DESC LIMIT 50`;
    }
    
    const rows = await query;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error cargando historial" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { destino, semana, rows, total_costo_mxn, total_kg, costo_promedio_kg, notas } = await request.json();
    if (!destino || !rows) return NextResponse.json({ error: "Destino y rows requeridos" }, { status: 400 });

    const [saved] = await sql`
      INSERT INTO destino_costos_historico (destino, semana, rows, total_costo_mxn, total_kg, costo_promedio_kg, notas)
      VALUES (${destino}, ${semana || 1}, ${JSON.stringify(rows)}, ${total_costo_mxn || 0}, ${total_kg || 0}, ${costo_promedio_kg || 0}, ${notas || null})
      RETURNING *
    `;
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: "No se guardó" }, { status: 500 });
  }
}