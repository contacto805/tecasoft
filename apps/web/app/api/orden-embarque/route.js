import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    let where = sql``;
    if (lotId) where = sql`WHERE id_lote = ${parseInt(lotId)}`;
    const rows = await sql`SELECT * FROM orden_embarque ${where} ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: crear (Pendiente)
export async function POST(request) {
  try {
    const b = await request.json();
    const folio = b.folio || `EMB-${Date.now().toString().slice(-8)}`;

    const [row] = await sql`
      INSERT INTO orden_embarque (
        folio, id_lote, id_orden_corte, fecha_salida,
        nombre_transportista, placas_vehiculo, destino_final,
        tarimas_cargadas, cajas_cargadas, estatus_embarque, kilos_totales, created_by
      ) VALUES (
        ${folio},
        ${b.id_lote ? parseInt(b.id_lote) : null},
        ${b.id_orden_corte ? parseInt(b.id_orden_corte) : null},
        ${b.fecha_salida || new Date().toISOString().slice(0,10)},
        ${b.nombre_transportista || null},
        ${b.placas_vehiculo || null},
        ${b.destino_final || null},
        ${parseInt(b.tarimas_cargadas)||0},
        ${parseInt(b.cajas_cargadas)||0},
        'Pendiente',
        ${parseFloat(b.kilos_totales)||0},
        ${b.created_by || 'sistema'}
      ) RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: cambio de estatus con reglas de negocio
export async function PUT(request) {
  try {
    const b = await request.json();
    const { id, estatus_embarque, ...rest } = b;

    if (!id || !estatus_embarque) return NextResponse.json({ error: "id y estatus_embarque requeridos" }, { status: 400 });

    const [current] = await sql`SELECT * FROM orden_embarque WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    let newStatus = estatus_embarque;

    // Regla: al pasar a En Tránsito -> descontar de inventario_bodega + pallet_output_summary
    if (newStatus === 'En Tránsito' && current.estatus_embarque !== 'En Tránsito') {
      // Descontar de inventario_bodega si existe para el lote
      if (current.id_lote) {
        await sql`
          UPDATE inventario_bodega 
          SET 
            total_tarimas = GREATEST(total_tarimas - ${parseInt(current.tarimas_cargadas)||0}, 0),
            total_cajas = GREATEST(total_cajas - ${parseInt(current.cajas_cargadas)||0}, 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE id_lote = ${current.id_lote}
        `;
      }
      // Marcar tarimas como embarcadas en pallet_output_summary (trazabilidad)
      await sql`
        UPDATE pallet_output_summary 
        SET estado = 'EMBARCADA', embarque_id = ${parseInt(id)}, updated_at = CURRENT_TIMESTAMP
        WHERE lot_id = ${current.id_lote} AND COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA')
        LIMIT ${parseInt(current.tarimas_cargadas) || 10}
      `;
    }

    // Regla: Entregado -> solo lectura (en frontend)
    if (newStatus === 'Entregado') {
      // Podría marcar lotes o loads como cerrados
    }

    const [updated] = await sql`
      UPDATE orden_embarque SET
        estatus_embarque = ${newStatus},
        nombre_transportista = COALESCE(${rest.nombre_transportista}, nombre_transportista),
        placas_vehiculo = COALESCE(${rest.placas_vehiculo}, placas_vehiculo),
        destino_final = COALESCE(${rest.destino_final}, destino_final),
        tarimas_cargadas = COALESCE(${rest.tarimas_cargadas != null ? parseInt(rest.tarimas_cargadas) : null}, tarimas_cargadas),
        cajas_cargadas = COALESCE(${rest.cajas_cargadas != null ? parseInt(rest.cajas_cargadas) : null}, cajas_cargadas),
        kilos_totales = COALESCE(${rest.kilos_totales != null ? parseFloat(rest.kilos_totales) : null}, kilos_totales),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
