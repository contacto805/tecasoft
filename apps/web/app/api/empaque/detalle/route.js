import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET detalles por lote o proceso
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const procesoId = searchParams.get("procesoId");

    let where = sql``;
    if (lotId) where = sql`WHERE id_lote = ${parseInt(lotId)}`;
    else if (procesoId) where = sql`WHERE id_proceso_linea = ${parseInt(procesoId)}`;

    const rows = await sql`
      SELECT d.*, l.lot_number as folio_lote_real 
      FROM detalle_empaque_calibres d
      LEFT JOIN lots l ON l.id = d.id_lote
      ${where}
      ORDER BY d.updated_at DESC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST / PUT : guardar o actualizar campos 100% editables (cualquier operario o supervisor)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      id_proceso_linea, id_lote, id_orden_corte,
      cajas_exportacion_calibre, kilos_netos_exportacion,
      cajas_nacional_calibre, kilos_netos_nacional,
      kilos_canica, kilos_merma_industrial, kilos_deshidratacion,
      clase_a_kg, semi_kg, danada_proceso_kg, danada_desecho_kg, calidad_salida,
      notas, usuario_captura
    } = body;

    if (!id_lote && !id_proceso_linea) {
      return NextResponse.json({ error: "id_lote requerido para trazabilidad" }, { status: 400 });
    }

    // Heredar folios
    let folioLote = body.folio_lote;
    let folioOrden = body.folio_orden_corte;
    if (id_lote && !folioLote) {
      const [l] = await sql`SELECT lot_number, cutting_order_id FROM lots WHERE id = ${parseInt(id_lote)} LIMIT 1`;
      folioLote = l?.lot_number;
      if (l?.cutting_order_id && !folioOrden) {
        const [co] = await sql`SELECT folio FROM cutting_orders WHERE id = ${l.cutting_order_id} LIMIT 1`;
        folioOrden = co?.folio;
      }
    }

    const [row] = await sql`
      INSERT INTO detalle_empaque_calibres (
        id_proceso_linea, id_lote, folio_lote, folio_orden_corte,
        cajas_exportacion_calibre, kilos_netos_exportacion,
        cajas_nacional_calibre, kilos_netos_nacional,
        kilos_canica, kilos_merma_industrial, kilos_deshidratacion,
        clase_a_kg, semi_kg, danada_proceso_kg, danada_desecho_kg, calidad_salida,
        notas, usuario_captura
      ) VALUES (
        ${id_proceso_linea || null},
        ${id_lote ? parseInt(id_lote) : null},
        ${folioLote},
        ${folioOrden},
        ${JSON.stringify(cajas_exportacion_calibre || {})},
        ${parseFloat(kilos_netos_exportacion) || 0},
        ${JSON.stringify(cajas_nacional_calibre || {})},
        ${parseFloat(kilos_netos_nacional) || 0},
        ${parseFloat(kilos_canica) || 0},
        ${parseFloat(kilos_merma_industrial) || 0},
        ${parseFloat(kilos_deshidratacion) || 0},
        ${parseFloat(clase_a_kg)||0}, ${parseFloat(semi_kg)||0}, ${parseFloat(danada_proceso_kg)||0}, ${parseFloat(danada_desecho_kg)||0}, ${calidad_salida || null},
        ${notas || null},
        ${usuario_captura || 'operario'}
      ) RETURNING *
    `;

    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: edición (requiere PIN de supervisor si ya existe)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, motivo_ajuste, usuario, pin_autorizado, ...updates } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Si es edición de datos ya guardados y se provee pin + motivo -> autorizar
    const [existing] = await sql`SELECT * FROM detalle_empaque_calibres WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

    // Si hay cambios en kilos y no es primera vez, exigir motivo
    const isSignificantEdit = (updates.kilos_netos_exportacion != null || updates.kilos_netos_nacional != null) && existing.kilos_netos_exportacion > 0;

    if (isSignificantEdit && (!motivo_ajuste || !pin_autorizado)) {
      return NextResponse.json({ error: "Se requiere PIN de Supervisor y Motivo de Ajuste para modificar kilos netos", requiresPin: true }, { status: 403 });
    }

    // Actualizar
    const [updated] = await sql`
      UPDATE detalle_empaque_calibres SET
        cajas_exportacion_calibre = COALESCE(${updates.cajas_exportacion_calibre ? JSON.stringify(updates.cajas_exportacion_calibre) : null}, cajas_exportacion_calibre),
        kilos_netos_exportacion = COALESCE(${updates.kilos_netos_exportacion != null ? parseFloat(updates.kilos_netos_exportacion) : null}, kilos_netos_exportacion),
        cajas_nacional_calibre = COALESCE(${updates.cajas_nacional_calibre ? JSON.stringify(updates.cajas_nacional_calibre) : null}, cajas_nacional_calibre),
        kilos_netos_nacional = COALESCE(${updates.kilos_netos_nacional != null ? parseFloat(updates.kilos_netos_nacional) : null}, kilos_netos_nacional),
        kilos_canica = COALESCE(${updates.kilos_canica != null ? parseFloat(updates.kilos_canica) : null}, kilos_canica),
        kilos_merma_industrial = COALESCE(${updates.kilos_merma_industrial != null ? parseFloat(updates.kilos_merma_industrial) : null}, kilos_merma_industrial),
        kilos_deshidratacion = COALESCE(${updates.kilos_deshidratacion != null ? parseFloat(updates.kilos_deshidratacion) : null}, kilos_deshidratacion),
        clase_a_kg = COALESCE(${updates.clase_a_kg != null ? parseFloat(updates.clase_a_kg) : null}, clase_a_kg),
        semi_kg = COALESCE(${updates.semi_kg != null ? parseFloat(updates.semi_kg) : null}, semi_kg),
        danada_proceso_kg = COALESCE(${updates.danada_proceso_kg != null ? parseFloat(updates.danada_proceso_kg) : null}, danada_proceso_kg),
        danada_desecho_kg = COALESCE(${updates.danada_desecho_kg != null ? parseFloat(updates.danada_desecho_kg) : null}, danada_desecho_kg),
        calidad_salida = COALESCE(${updates.calidad_salida}, calidad_salida),
        notas = COALESCE(${updates.notas}, notas),
        updated_by = ${usuario || 'supervisor'},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Log auditoría PIN si aplica
    if (motivo_ajuste) {
      await sql`
        INSERT INTO pin_audit_log (user_id, module, entity_type, entity_id, campo_modificado, valor_anterior, valor_nuevo, motivo_ajuste, timestamp)
        VALUES (${usuario || 'supervisor'}, 'empaque', 'detalle_empaque_calibres', ${parseInt(id)}, 'kilos_netos', 
          ${String(existing.kilos_netos_exportacion)}, ${String(updated.kilos_netos_exportacion)}, ${motivo_ajuste}, CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
