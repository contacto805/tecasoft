import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folioCorte = searchParams.get("folioCorte");
    let where = sql``;
    if (folioCorte) where = sql`WHERE folio_corte = ${folioCorte}`;
    const rows = await sql`SELECT * FROM logistica_viajes ${where} ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const b = await request.json();
    const folio = b.folio_viaje || `VIAJE-${Date.now().toString().slice(-8)}`;
    const [row] = await sql`
      INSERT INTO logistica_viajes (folio_viaje, folio_corte, id_cuadrilla, id_camion, tarifa_flete_pactada, tarifa_corte_por_kilo, cajas_campo_enviadas)
      VALUES (${folio}, ${b.folio_corte || null}, ${b.id_cuadrilla || null}, ${b.id_camion || null}, ${parseFloat(b.tarifa_flete_pactada)||0}, ${parseFloat(b.tarifa_corte_por_kilo)||0}, ${parseInt(b.cajas_campo_enviadas)||0})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
