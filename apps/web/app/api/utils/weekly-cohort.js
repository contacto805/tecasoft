import sql from "@/app/api/utils/sql";
import {allocateFixedExpenses, getFixedExpenses} from "@/app/api/utils/fixed-expenses";
import {amount, money} from "@/utils/closing-period";

const sum = (rows, key) => rows.reduce((total, row) => total + amount(row[key]), 0);

function cohortRows(start, end) {
  return sql`
    WITH primary_receipts AS (
      SELECT lot_id, min(public_scale_date::date) AS received_on, SUM(total_kg_weighed) AS kg,
        array_agg(id ORDER BY id) AS source_ids
      FROM fruit_input_weighings WHERE total_kg_weighed > 0 AND public_scale_date IS NOT NULL GROUP BY lot_id
    ), alternate_receipts AS (
      SELECT w.lot_id, MIN(timezone('America/Mexico_City', w."timestamp"::timestamptz)::date) AS received_on,
        SUM(w.net_weight) AS kg, array_agg(w.id ORDER BY w.id) AS source_ids
      FROM weighings w
      WHERE w.net_weight > 0 AND w."timestamp" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM primary_receipts p WHERE p.lot_id = w.lot_id)
      GROUP BY w.lot_id
    ), receipts AS (
      SELECT *, 'fruit_input_weighings' AS source FROM primary_receipts
      UNION ALL
      SELECT *, 'weighings' AS source FROM alternate_receipts
    ), cohort AS (
      SELECT r.*, l.lot_number, l.producer, COALESCE(l.applied_purchase_price_mxn_kg,l.fruit_price) AS fruit_price
      FROM receipts r JOIN lots l ON l.id = r.lot_id
      WHERE r.received_on BETWEEN ${start}::date AND ${end}::date
    ), cold AS (
      SELECT p.lot_id, SUM(p.total_kg) AS kg, SUM(p.pallet_count) AS pallets,
        jsonb_agg(jsonb_build_object('id',p.id,'folio',p.folio_tarima,'caliber',p.caliber,
          'kg',p.total_kg,'pallets',p.pallet_count,'status',p.estado,
          'presentacion_kg',p.package_kg,'cajas',p.boxes_count,'configuracion_id',p.pallet_config_id,'capacidad_cajas',p.capacity_snapshot) ORDER BY p.id) AS details
      FROM pallet_output_summary p JOIN cohort c ON p.lot_id = c.lot_id
      WHERE p.embarque_id IS NULL AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
      GROUP BY p.lot_id
    ), batches AS (
      SELECT pb.lot_id, SUM(pb.process_kg) AS process_kg, SUM(pb.desecho_kg) AS waste_kg,
        SUM(pb.merma_kg) AS loss_kg, SUM(ps.packed_kg) AS packed_kg, SUM(ps.kg_a) AS kg_a, SUM(ps.kg_b) AS kg_b, array_agg(pb.id ORDER BY pb.id) AS ids
      FROM production_batches pb JOIN cohort c ON c.lot_id = pb.lot_id
      LEFT JOIN LATERAL (
        SELECT SUM(d.total_kg) AS packed_kg,
          SUM(d.total_kg) FILTER (WHERE UPPER(d.class_name) IN ('A','SUPER','EXTRA','PRIMERA')) AS kg_a,
          SUM(d.total_kg) FILTER (WHERE UPPER(d.class_name) IN ('B','MEDIANO','TERCERA','CUARTA')) AS kg_b
        FROM production_selection_details d WHERE d.production_batch_id = pb.id
      ) ps ON true
      WHERE UPPER(COALESCE(pb.status,'')) = 'CONFIRMADO'
      GROUP BY pb.lot_id
    ), repack AS (
      SELECT d.lot_id, SUM(d.kg) FILTER (WHERE d.destination_type='proceso') AS process_kg,
        SUM(d.kg) FILTER (WHERE d.destination_type='desecho') AS waste_kg,
        SUM(d.kg) FILTER (WHERE d.destination_type='merma') AS loss_kg,
        array_agg(DISTINCT o.id ORDER BY o.id) AS ids
      FROM reempaque_details d JOIN reempaque_operations o ON o.id=d.reempaque_id
      JOIN cohort c ON c.lot_id=d.lot_id
      WHERE o.status='CONFIRMADO'
      GROUP BY d.lot_id
    ), live_loads AS (
      SELECT lh.*, COALESCE(lh.lot_id, mb.lot_id) AS legacy_lot_id
      FROM load_history lh LEFT JOIN master_batches mb ON lh.master_batch_id = mb.id
      WHERE lower(COALESCE(lh.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado')
        AND NOT EXISTS (SELECT 1 FROM notas n WHERE n.folio = lh.factura_folio
          AND lower(COALESCE(n.estatus,'')) IN ('cancelado','cancelada','cancelled','canceled','anulado'))
    ), lines AS (
      SELECT h.id AS load_id, d.lot_id, SUM(d.total_kg) AS kg, SUM(COALESCE(d.subtotal,0)) AS subtotal,
        array_agg(d.id ORDER BY d.id) AS detail_ids
      FROM live_loads h JOIN load_details d ON d.load_id = h.id
      GROUP BY h.id,d.lot_id
      UNION ALL
      SELECT h.id, h.legacy_lot_id, h.total_kg, h.total_amount, NULL
      FROM live_loads h WHERE NOT EXISTS (SELECT 1 FROM load_details d WHERE d.load_id = h.id)
    ), weighted AS (
      SELECT d.*, h.load_date, h.factura_folio, h.customer_name, h.total_amount,
        UPPER(NULLIF(TRIM(h.currency),'')) AS currency,
        COALESCE(rate.fx, CASE WHEN COALESCE(to_jsonb(h)->>'exchange_rate',to_jsonb(h)->>'tipo_cambio') ~ '^[0-9]+([.][0-9]+)?$'
          THEN COALESCE(to_jsonb(h)->>'exchange_rate',to_jsonb(h)->>'tipo_cambio')::numeric END) AS fx,
        CASE WHEN SUM(GREATEST(COALESCE(d.subtotal,0),0)) OVER (PARTITION BY h.id) > 0
          THEN GREATEST(COALESCE(d.subtotal,0),0)
          ELSE GREATEST(COALESCE(d.kg,0),0) END AS weight,
        COUNT(*) OVER (PARTITION BY h.id) AS part_count
      FROM lines d JOIN live_loads h ON d.load_id = h.id
      LEFT JOIN LATERAL (
        SELECT ca.exchange_rate::numeric AS fx
        FROM customer_accounts ca JOIN load_history parent ON parent.id::text = ca.trip_reference_id::text
        WHERE ca.transaction_type='receivable' AND ca.trip_type='load' AND ca.exchange_rate > 0
          AND (parent.id = h.id OR (NULLIF(h.factura_folio,'') IS NOT NULL AND parent.factura_folio = h.factura_folio))
        ORDER BY ca.id LIMIT 1
      ) rate ON UPPER(TRIM(h.currency)) = 'USD'
    ), amounts AS (
      SELECT w.*, CASE WHEN part_count = 1 THEN total_amount
        ELSE round(total_amount::numeric * SUM(weight) OVER seq / NULLIF(SUM(weight) OVER all_parts,0),2)
          - round(total_amount::numeric * (SUM(weight) OVER seq - weight) / NULLIF(SUM(weight) OVER all_parts,0),2)
        END AS amount
      FROM weighted w
      WINDOW seq AS (PARTITION BY load_id ORDER BY lot_id NULLS LAST ROWS UNBOUNDED PRECEDING),
        all_parts AS (PARTITION BY load_id)
    ), sales AS (
      SELECT s.lot_id, SUM(s.kg) AS kg,
        jsonb_agg(jsonb_build_object('load_id',s.load_id,'detail_ids',s.detail_ids,'nota',s.factura_folio,
          'fecha',s.load_date,'cliente',s.customer_name,'kg',s.kg,'importe',s.amount,'moneda',s.currency,
          'tipo_cambio',s.fx,'dinero',CASE WHEN s.currency = 'MXN' THEN s.amount
             WHEN s.currency = 'USD' AND s.fx > 0 THEN round((s.amount * s.fx)::numeric,2) END,
          'tarimas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'folio',p.folio_tarima,'kg',p.total_kg,'presentacion_kg',p.package_kg,'cajas',p.boxes_count) ORDER BY p.id)
           FROM pallet_output_summary p WHERE p.embarque_id = s.load_id AND p.lot_id = s.lot_id),'[]'::jsonb))
          ORDER BY s.load_date,s.load_id) AS details
      FROM amounts s JOIN cohort c ON c.lot_id = s.lot_id
      GROUP BY s.lot_id
    ), waste_sales AS (
      SELECT c.lot_id, jsonb_agg(jsonb_build_object('id',w.id,'folio',w.sales_folio,'fecha',w.date,
          'proceso_kg',w.process_kg,'desecho_kg',w.waste_kg,'importe',w.total_price,'moneda',COALESCE(w.currency,'MXN'),'tipo_cambio',w.exchange_rate,
          'proceso_dinero',round((w.total_price::numeric * CASE WHEN UPPER(COALESCE(w.currency,'MXN'))='MXN' THEN 1 ELSE NULLIF(w.exchange_rate,0) END) * COALESCE(w.process_kg,0) / NULLIF(COALESCE(w.process_kg,0) + COALESCE(w.waste_kg,0),0),2),
          'desecho_dinero',round(w.total_price::numeric * CASE WHEN UPPER(COALESCE(w.currency,'MXN'))='MXN' THEN 1 ELSE NULLIF(w.exchange_rate,0) END,2) - round((w.total_price::numeric * CASE WHEN UPPER(COALESCE(w.currency,'MXN'))='MXN' THEN 1 ELSE NULLIF(w.exchange_rate,0) END) * COALESCE(w.process_kg,0) / NULLIF(COALESCE(w.process_kg,0) + COALESCE(w.waste_kg,0),0),2))
          ORDER BY w.id) AS details
      FROM sales_of_process_and_waste w LEFT JOIN master_batches mb ON w.master_batch_id = mb.id
      JOIN cohort c ON c.lot_id = COALESCE(w.lot_id,mb.lot_id)
      WHERE w.total_price IS NOT NULL AND COALESCE(w.process_kg,0)+COALESCE(w.waste_kg,0)>0
        AND lower(COALESCE(w.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado')
      GROUP BY c.lot_id
    )
    SELECT c.*, round(c.kg::numeric * c.fruit_price::numeric,2) AS cost,
      COALESCE(p.process_kg,0)+COALESCE(r.process_kg,0) AS process_kg,
      COALESCE(p.waste_kg,0)+COALESCE(r.waste_kg,0) AS waste_kg,
      COALESCE(p.loss_kg,0)+COALESCE(r.loss_kg,0) AS loss_kg,
      p.packed_kg,p.kg_a,p.kg_b,p.ids AS production_ids,r.ids AS repacking_ids,
      round(i.kg*c.fruit_price::numeric,2) AS cold_fruit_cost_mxn,
      COALESCE(i.kg,0) AS cold_kg, COALESCE(i.pallets,0) AS cold_pallets, COALESCE(i.details,'[]'::jsonb) AS cold_details,
      COALESCE(s.kg,0) AS sold_kg, COALESCE(s.details,'[]'::jsonb) AS sales,
      COALESCE(ws.details,'[]'::jsonb) AS waste_sales
    FROM cohort c LEFT JOIN cold i USING(lot_id) LEFT JOIN batches p USING(lot_id) LEFT JOIN repack r USING(lot_id)
    LEFT JOIN sales s USING(lot_id) LEFT JOIN waste_sales ws USING(lot_id)
    ORDER BY c.received_on,c.lot_id
  `;
}

export async function getWeeklyOrigin(start, end) {
  const [lots, expenses, unresolved] = await Promise.all([
    cohortRows(start,end), getFixedExpenses(),
    sql`
      SELECT h.id AS load_id, h.factura_folio AS nota, h.load_date AS fecha,
        COALESCE(d.lot_id,h.lot_id,mb.lot_id) AS lot_id
      FROM load_history h LEFT JOIN master_batches mb ON h.master_batch_id = mb.id
      LEFT JOIN LATERAL (SELECT DISTINCT lot_id FROM load_details WHERE load_id=h.id) d ON true
      WHERE h.load_date::date BETWEEN ${start}::date AND ${end}::date
        AND lower(COALESCE(h.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado')
        AND NOT EXISTS (SELECT 1 FROM fruit_input_weighings f WHERE f.lot_id = COALESCE(d.lot_id,h.lot_id,mb.lot_id)
          AND f.public_scale_date IS NOT NULL AND f.total_kg_weighed > 0)
        AND NOT EXISTS (SELECT 1 FROM weighings w WHERE w.lot_id = COALESCE(d.lot_id,h.lot_id,mb.lot_id)
          AND w."timestamp" IS NOT NULL AND w.net_weight > 0)
      ORDER BY h.load_date,h.id
    `
  ]);
  const ventas = lots.flatMap(lot => lot.sales.map(sale => ({
    ...sale, lote:lot.lot_number, lot_id:lot.lot_id, fecha_ingreso:lot.received_on,
  })));
  const descartes = lots.flatMap(lot => lot.waste_sales.map(sale => ({...sale, lote:lot.lot_number, lot_id:lot.lot_id})));
  const porCalibre = {};
  for (const pallet of lots.flatMap(lot => lot.cold_details)) {
    const key = pallet.caliber || 'Sin calibre';
    porCalibre[key] = (porCalibre[key] || 0) + amount(pallet.pallets);
  }
  return {
    lotes:lots, ventas, descartes, embarques_sin_recepcion:unresolved,
    ventas_pendientes_mxn:ventas.filter(sale => sale.dinero == null),
    kg_recibidos:sum(lots,'kg'), kg_vendidos:sum(lots,'sold_kg'), kg_frio:sum(lots,'cold_kg'),
    valor_fruta_en_frio_mxn:money(sum(lots,'cold_fruit_cost_mxn')),
    kg_proceso:sum(lots,'process_kg'), kg_desecho:sum(lots,'waste_kg'), kg_merma:sum(lots,'loss_kg'),
    renta_y_fijos:allocateFixedExpenses(expenses,start,end),
    inventario_por_calibre:porCalibre,
    ventas_mxn:money(sum(ventas,'dinero')), entrada_mxn:money(sum(lots,'cost')),
    proceso_mxn:money(sum(descartes,'proceso_dinero')), desecho_mxn:money(sum(descartes,'desecho_dinero')),
  };
}
