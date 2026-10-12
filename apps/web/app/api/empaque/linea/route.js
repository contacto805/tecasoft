import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: lista procesos de linea por lote o todos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const ordenId = searchParams.get("ordenCorteId");

    let where = sql``;
    if (lotId) where = sql`WHERE id_lote = ${parseInt(lotId)}`;
    else if (ordenId) where = sql`WHERE id_orden_corte = ${parseInt(ordenId)}`;

    const rows = await sql`
      SELECT le.*, l.lot_number as folio_lote_real, co.folio as folio_orden_real
      FROM linea_empaque le
      LEFT JOIN lots l ON l.id = le.id_lote
      LEFT JOIN cutting_orders co ON co.id = le.id_orden_corte
      ${where}
      ORDER BY le.fecha_clasificacion DESC, le.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: crear proceso de linea + heredar folios
export async function POST(request) {
  try {
    const body = await request.json();
    const { id_lote, id_orden_corte, fecha_clasificacion, hora_inicio, hora_fin, id_linea_fisica, created_by } = body;

    if (!id_lote && !id_orden_corte) {
      return NextResponse.json({ error: "Se requiere id_lote o id_orden_corte para trazabilidad" }, { status: 400 });
    }

    // Heredar folios (Llaves Foráneas y Folios Heredados)
    let folioLote = body.folio_lote;
    let folioOrden = body.folio_orden_corte;

    if (id_lote && !folioLote) {
      const [l] = await sql`SELECT lot_number FROM lots WHERE id = ${parseInt(id_lote)} LIMIT 1`;
      folioLote = l?.lot_number || null;
    }
    if (id_orden_corte && !folioOrden) {
      const [co] = await sql`SELECT folio FROM cutting_orders WHERE id = ${parseInt(id_orden_corte)} LIMIT 1`;
      folioOrden = co?.folio || null;
    }

    const [row] = await sql`
      INSERT INTO linea_empaque (
        id_lote, id_orden_corte, folio_lote, folio_orden_corte,
        fecha_clasificacion, hora_inicio, hora_fin, id_linea_fisica, created_by
      ) VALUES (
        ${id_lote ? parseInt(id_lote) : null},
        ${id_orden_corte ? parseInt(id_orden_corte) : null},
        ${folioLote},
        ${folioOrden},
        ${fecha_clasificacion || new Date().toISOString().slice(0,10)},
        ${hora_inicio || null},
        ${hora_fin || null},
        ${id_linea_fisica || null},
        ${created_by || 'sistema'}
      ) RETURNING *
    `;

    // Log trazabilidad
    await sql`
      INSERT INTO traceability_log (lot_id, event_type, event_category, event_description, related_entity_type, related_entity_id, user_name, timestamp)
      VALUES (${id_lote || null}, 'LINEA_EMPAQUE', 'PROCESO', 'Inicio de línea de empaque', 'linea_empaque', ${row.id}, ${created_by || 'sistema'}, CURRENT_TIMESTAMP)
    `;

    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
