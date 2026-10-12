import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get("semana");
    const latestOnly = searchParams.get("latest") === "true";

    if (latestOnly || !week) {
      const rows = await sql`SELECT * FROM precios_fruta_campo ORDER BY created_at DESC LIMIT 1`;
      return NextResponse.json(rows[0] || null);
    }

    if (week) {
      const rows = await sql`SELECT * FROM precios_fruta_campo WHERE semana = ${parseInt(week)} ORDER BY created_at DESC`;
      return NextResponse.json(rows || []);
    }

    const rows = await sql`SELECT * FROM precios_fruta_campo ORDER BY semana DESC, created_at DESC LIMIT 50`;
    return NextResponse.json(rows || []);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      semana, fecha_actualizacion,
      calibre_precios_compra, precio_de_compra, precio_de_venta,
      precios_en_campo, campo_operativos_6kg, caja_6kg_mxn, precio_venta_usd_6kg,
      campo_operativos_10kg, caja_10kg, precio_venta_usd_10kg,
      tipo_cambio, precio_100, precio_150, precio_180, precio_pela_palo,
      concepto_tipo_carga, concepto_costo_operativo, precio_por_kilo,
      creado_por
    } = body;

    const result = await sql`
      INSERT INTO precios_fruta_campo 
      (semana, fecha_actualizacion,
       calibre_precios_compra, precio_de_compra, precio_de_venta,
       precios_en_campo, campo_operativos_6kg, caja_6kg_mxn, precio_venta_usd_6kg,
       campo_operativos_10kg, caja_10kg, precio_venta_usd_10kg,
       tipo_cambio, precio_100, precio_150, precio_180, precio_pela_palo,
       concepto_tipo_carga, concepto_costo_operativo, precio_por_kilo, creado_por)
      VALUES 
      (${semana || 23}, ${fecha_actualizacion || new Date().toISOString().split('T')[0]},
       ${calibre_precios_compra || ''}, ${precio_de_compra || 0}, ${precio_de_venta || 0},
       ${precios_en_campo || 0}, ${campo_operativos_6kg || 0}, ${caja_6kg_mxn || 0}, ${precio_venta_usd_6kg || 0},
       ${campo_operativos_10kg || 0}, ${caja_10kg || 0}, ${precio_venta_usd_10kg || 0},
       ${tipo_cambio || 17.2}, ${precio_100 || 0}, ${precio_150 || 0}, ${precio_180 || 0}, ${precio_pela_palo || 0},
       ${concepto_tipo_carga || ''}, ${concepto_costo_operativo || ''}, ${precio_por_kilo || 0}, ${creado_por || 'superadmin'})
      RETURNING *
    `;
    return NextResponse.json(result[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}