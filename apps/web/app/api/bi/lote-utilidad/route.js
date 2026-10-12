import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    let where = sql``;
    if (lotId) where = sql`WHERE li.id = ${parseInt(lotId)}`;

    // Query lo más cercano posible al spec proporcionado (usando tablas existentes + prorrateo + insumos reales editados)
    const rows = await sql`
      SELECT 
        li.id as centro_costos_lote,
        li.lot_number,
        oc.producer_name as id_productor,
        oc.orchard_name as id_huerto,
        COALESCE(oc.status, 'Compra Directa') as modulo_contratacion,

        -- 1. INGRESOS (MXN usando tipo_cambio si aplica; fallback a subtotal)
        COALESCE(lc.subtotal_ingreso_productor + lc.impuesto_iva, 0) as ingresos_totales_mxn,

        -- 2. COSTO ADQUISICION (solo Compra Directa)
        CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN COALESCE(lc.subtotal_ingreso_productor,0) ELSE 0 END as costo_adquisicion_fruta_mxn,

        -- 3. LOGISTICOS PRORRATEADOS (solo Compra Directa; prorrateo por peso)
        CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN 
          COALESCE(lc.valor_flete * (li.total_kg_received::numeric / NULLIF((SELECT SUM(total_kg_received) FROM lots WHERE cutting_order_id = oc.id),0)), 0)
        ELSE 0 END as costo_flete_prorrateado_mxn,

        CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN COALESCE(lc.retencion_cuadrilla_corte,0) ELSE 0 END as costo_cuadrilla_corte_mxn,

        -- 4. INSUMOS (edición REAL del supervisor)
        COALESCE((SELECT SUM(costo_total_insumo_lote) FROM consumo_insumos_lote WHERE folio_proceso IN (SELECT id FROM linea_empaque WHERE id_lote=li.id)),0) as costo_insumos_empaque_mxn,

        -- 5. REGALIAS MARCA (desde detalle + marcas)
        COALESCE((
          SELECT SUM(d.kilos_netos_exportacion * (COALESCE(m.costo_regalia_por_caja_usd,0) * 19.5 / 11.34))
          FROM detalle_empaque_calibres d
          LEFT JOIN marcas_etiquetas m ON m.id = (SELECT id FROM marcas_etiquetas LIMIT 1)
          WHERE d.id_lote = li.id
        ),0) as costo_regalias_marca_mxn,

        -- 6. UTILIDAD NETA REAL DEL LOTE (exacto al spec)
        (
          COALESCE(lc.subtotal_ingreso_productor + lc.impuesto_iva, 0) - 
          (
            CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN COALESCE(lc.subtotal_ingreso_productor, 0) ELSE 0 END +
            CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN COALESCE(lc.valor_flete * (li.total_kg_received::numeric / NULLIF((SELECT SUM(total_kg_received) FROM lots WHERE cutting_order_id = oc.id),0)), 0) ELSE 0 END +
            CASE WHEN COALESCE(oc.status,'') = 'Compra Directa' THEN COALESCE(lc.retencion_cuadrilla_corte, 0) ELSE 0 END +
            COALESCE((SELECT SUM(costo_total_insumo_lote) FROM consumo_insumos_lote WHERE folio_proceso IN (SELECT id FROM linea_empaque WHERE id_lote=li.id)),0) +
            COALESCE((
              SELECT SUM(d.kilos_netos_exportacion * (COALESCE(m.costo_regalia_por_caja_usd,0) * 19.5 / 11.34))
              FROM detalle_empaque_calibres d
              LEFT JOIN marcas_etiquetas m ON m.id = (SELECT id FROM marcas_etiquetas LIMIT 1)
              WHERE d.id_lote = li.id
            ),0)
          )
        ) as utilidad_neta_real_lote_mxn,

        (COALESCE(lc.kilos_netos_exportacion,0) + COALESCE(lc.kilos_netos_nacional,0) + COALESCE(lc.kilos_canica,0) + COALESCE(lc.kilos_merma_industrial,0) + COALESCE(lc.kilos_deshidratacion,0)) as kilos_totales_salida,
        COALESCE(li.total_kg_received,0) as peso_bruto_recibido
      FROM lots li
      LEFT JOIN cutting_orders oc ON oc.id = li.cutting_order_id
      LEFT JOIN liquidacion_contable lc ON lc.id_lote = li.id
      ${where}
      ORDER BY li.created_at DESC
      LIMIT 50
    `;

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
