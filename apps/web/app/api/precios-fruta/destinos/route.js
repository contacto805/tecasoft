import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM fruta_destinos WHERE activo = true ORDER BY id ASC`;
    return NextResponse.json(rows || []);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      nombre, pais, ciudad, moneda, tipo_cambio,
      pallets, cajas_por_pallet, kg_por_caja,
      fecha_vigencia
    } = body;

    const palletsN = parseInt(pallets) || 24;
    const cajasN = parseInt(cajas_por_pallet) || 156;
    const kgN = parseFloat(kg_por_caja) || 6;

    const totalCajas = palletsN * cajasN;
    const kgPorPallet = cajasN * kgN;
    const kgTotales = totalCajas * kgN;

    const [row] = await sql`
      INSERT INTO fruta_destinos 
      (nombre, pais, ciudad, moneda, tipo_cambio, pallets, cajas_por_pallet, kg_por_caja, 
       total_cajas, kg_por_pallet, kg_totales, fecha_vigencia, activo)
      VALUES 
      (${nombre || 'Nuevo Destino'}, ${pais || ''}, ${ciudad || ''}, ${moneda || 'MXN'}, 
       ${parseFloat(tipo_cambio) || 17.2}, ${palletsN}, ${cajasN}, ${kgN},
       ${totalCajas}, ${kgPorPallet}, ${kgTotales}, ${fecha_vigencia || null}, true)
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const palletsN = parseInt(rest.pallets) || 24;
    const cajasN = parseInt(rest.cajas_por_pallet) || 156;
    const kgN = parseFloat(rest.kg_por_caja) || 6;
    const totalCajas = palletsN * cajasN;
    const kgPorPallet = cajasN * kgN;
    const kgTotales = totalCajas * kgN;

    const [updated] = await sql`
      UPDATE fruta_destinos SET 
        nombre = ${rest.nombre}, pais = ${rest.pais}, ciudad = ${rest.ciudad},
        moneda = ${rest.moneda}, tipo_cambio = ${parseFloat(rest.tipo_cambio) || 17.2},
        pallets = ${palletsN}, cajas_por_pallet = ${cajasN}, kg_por_caja = ${kgN},
        total_cajas = ${totalCajas}, kg_por_pallet = ${kgPorPallet}, kg_totales = ${kgTotales},
        fecha_vigencia = ${rest.fecha_vigencia || null},
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}