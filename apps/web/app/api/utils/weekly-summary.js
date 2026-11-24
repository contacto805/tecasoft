import sql from "@/app/api/utils/sql";
import {fixedExpenseType} from "@/app/api/utils/fixed-expenses";
import {getWeeklyOrigin} from "@/app/api/utils/weekly-cohort";
import {amount, closingTotals, dateKey, money, validWeek} from "@/utils/closing-period";
import {getExtraordinaryEntries} from "@/utils/closing-extraordinary";

export async function getWeeklySummary(start, end) {
  const [origin, [week]] = await Promise.all([
    getWeeklyOrigin(start, end),
    sql`
      WITH financial_lines AS (
        SELECT 'Gastos ordinarios' AS concept, e.id AS source_id, e.expense_date::date AS date,
          e.product_name AS reference, e.total::numeric AS amount
        FROM expenses e WHERE e.expense_date::date BETWEEN ${start}::date AND ${end}::date
          AND e.expense_type IS DISTINCT FROM ${fixedExpenseType}
          AND COALESCE(lower(e.status),'') NOT IN ('rechazado','cancelado','cancelada')
          AND NOT EXISTS (SELECT 1 FROM payroll_expense_link p WHERE p.expense_id=e.id)
        UNION ALL
        SELECT 'Costos operativos', o.id, o.cost_date::date, o.cost_concept,
          COALESCE(NULLIF(to_jsonb(o)->>'amount_mxn','')::numeric,
            CASE WHEN UPPER(to_jsonb(o)->>'currency')='MXN' THEN NULLIF(to_jsonb(o)->>'amount','')::numeric END)
        FROM operating_costs o WHERE o.cost_date::date BETWEEN ${start}::date AND ${end}::date
          AND lower(COALESCE(o.status,'')) IN ('confirmado','aprobado','pagado','pendiente')
          AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id::text=to_jsonb(o)->>'expense_id'
            OR (lower(COALESCE(o.module_origin,'')) IN ('gastos','expenses')
              AND e.id::text=COALESCE(to_jsonb(o)->>'source_id',to_jsonb(o)->>'related_id')))
          AND lower(COALESCE(o.cost_category,'')) NOT IN ('produccion','compra_inventario','nomina','nómina')
        UNION ALL
        SELECT 'Fletes', f.id, COALESCE(f.freight_date::date,f.created_at::date), NULL, f.price::numeric
        FROM crew_freights f WHERE COALESCE(f.freight_date::date,f.created_at::date) BETWEEN ${start}::date AND ${end}::date
        UNION ALL
        SELECT 'Cuadrillas', co.id, co.cutting_date::date,co.folio,
          (co.payable_kg * co.applied_crew_rate)::numeric
        FROM cutting_orders co WHERE co.cutting_date::date BETWEEN ${start}::date AND ${end}::date
          AND COALESCE(co.payable_kg,0)>0
        UNION ALL
        SELECT 'Corredores', b.id, b.note_date::date, NULL, b.amount::numeric
        FROM broker_notes b WHERE b.note_date::date BETWEEN ${start}::date AND ${end}::date
        UNION ALL
        SELECT 'Nómina', pp.id, pp.week_start_date::date, NULL, SUM(pr.net_salary)::numeric
        FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.payroll_period_id
        WHERE pp.week_start_date::date BETWEEN ${start}::date AND ${end}::date
          AND lower(COALESCE(pp.status,'')) IN ('aprobado','pagado')
        GROUP BY pp.id,pp.week_start_date
      )
      SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.concept,f.date,f.source_id)
          FROM financial_lines f),'[]'::jsonb) AS financial_lines,
      (SELECT SUM(quantity_available * cost_per_unit) FROM materials_inventory) AS materiales,
      COALESCE((SELECT id FROM weekly_closings WHERE week_start_date=${start}::date
        AND week_end_date=${end}::date ORDER BY id DESC LIMIT 1),0) AS closing_id
    `
  ]);
  const fixed = origin.renta_y_fijos.totals;
  const sumConcept = (...concepts) => money(week.financial_lines
    .filter(row => concepts.includes(row.concept)).reduce((total,row)=>total+amount(row.amount),0));
  const ingresoFrutaDetalle = origin.lotes.map(lot => ({
    lot_id:lot.lot_id, lot_number:lot.lot_number, fecha:lot.received_on, productor:lot.producer,
    kg:amount(lot.kg), dinero:lot.cost == null ? null : amount(lot.cost), fuente:lot.source, registros:lot.source_ids,
  }));
  const flow = {
    ingreso_fruta_detalle: ingresoFrutaDetalle, cargas_detalle:origin.ventas,
    origen:origin, total_cargas_dinero:origin.ventas_mxn, total_cargas_kg:origin.kg_vendidos,
    total_ventas_desecho_dinero:origin.desecho_mxn, total_ventas_proceso_dinero:origin.proceso_mxn,
    total_entradas_fruta_dinero:origin.entrada_mxn, total_entradas_fruta_kg:origin.kg_recibidos,
    total_desecho_kg:origin.kg_desecho, total_proceso_kg:origin.kg_proceso, merma_kg:origin.kg_merma,
    total_gastos:sumConcept("Gastos ordinarios","Costos operativos"), total_cuadrilla_dinero:sumConcept("Cuadrillas"),
    movimientos_mxn:week.financial_lines,
    produccion:{
      kg_recibidos:origin.kg_recibidos, kg_lotificados:origin.lotes.reduce((sum,lot)=>sum+amount(lot.packed_kg),0),
      calidad_a:origin.lotes.reduce((sum,lot)=>sum+amount(lot.kg_a),0),
      calidad_b:origin.lotes.reduce((sum,lot)=>sum+amount(lot.kg_b),0),
      proceso:origin.kg_proceso, desecho:origin.kg_desecho, merma:origin.kg_merma,
      tarimas_producidas:origin.lotes.reduce((sum,lot)=>sum+amount(lot.cold_pallets)+lot.sales.reduce((total,sale)=>total+sale.tarimas.length,0),0),
      rendimiento_lotes:origin.lotes.map(lot=>({lot_number:lot.lot_number,producer:lot.producer,
        kg_recibidos:lot.kg,kg_lotificado:lot.packed_kg,a:lot.kg_a,proceso:lot.process_kg,merma:lot.loss_kg}))
    }, total_broker_notes:sumConcept("Corredores"),
    total_fletes_dinero:sumConcept("Fletes"), nomina_semanal:sumConcept("Nómina"),
    valor_inventario_materiales:amount(week.materiales), inventario_tarimas_por_calibre:origin.inventario_por_calibre,
    conceptos_fijos:origin.renta_y_fijos,
    renta_automatica:fixed.renta, luz_automatica:money(fixed.luz_frio + fixed.luz_empaque),
    otros_fijos:money(fixed.renta_unidades + fixed.mantenimientos), frio_kg:origin.kg_frio,
    closing_id:week.closing_id,
    fuentes:[
      ['Recepción y costo de fruta','Pesadas de ingreso; en su ausencia, pesadas individuales. Precio pactado del lote.'],
      ['Inventario en frío','Tarimas activas por lote; se excluyen embarcadas, canceladas y reempacadas.'],
      ['Ventas por lote','Nota, embarque y detalle por lote. La fecha de venta se conserva.'],
      ['Proceso, desecho y merma','Kilos de corridas confirmadas. Importes de ventas efectivas de proceso y desecho.'],
      ['Nómina, fletes y corredores','Nómina aprobada o pagada, fletes y notas de corredores del período.'],
      ['Gastos ordinarios','Gastos y costos operativos de la semana, sin los gastos fijos prorrateados ni el gasto ligado a nómina.'],
      ['Gastos fijos','Concepto, periodo, referencia y revisión del gasto en el módulo de Gastos.'],
    ],
  };
  return flow;
}

export function getManualRent(closing) {
  if (!closing) return null;
  let detail = closing.detalle_integral;
  if (typeof detail === "string") {
    try { detail = JSON.parse(detail); } catch { detail = null; }
  }
  if (detail && Object.hasOwn(detail,'renta_manual')) return detail.renta_manual;
  return amount(closing.porcentaje_renta) || null;
}

export function closingForm(flow, manualRent, extra = []) {
  return {
    conceptosExtraordinarios:extra,
    totalCargasDinero:flow.total_cargas_dinero, totalVentasDesechoDinero:flow.total_ventas_desecho_dinero,
    totalVentasProcesoDinero:flow.total_ventas_proceso_dinero, valorInventarioMateriales:flow.valor_inventario_materiales,
    inventarioTarimas:flow.inventario_tarimas_por_calibre,
    totalGastos:flow.total_gastos, totalEntradasFrutaDinero:flow.total_entradas_fruta_dinero,
    totalCuadrillaDinero:flow.total_cuadrilla_dinero, totalBrokerNotes:flow.total_broker_notes,
    nominaSemanal:flow.nomina_semanal, porcentajeRenta:manualRent ?? 0,
    rentaAplicada:manualRent ?? flow.renta_automatica, porcentajeLuz:flow.luz_automatica, otrosFijos:flow.otros_fijos,
    totalCargasKg:flow.total_cargas_kg, totalCuadrillaKg:0, totalEntradasFrutaKg:flow.total_entradas_fruta_kg,
    totalDesechoKg:flow.total_desecho_kg, totalProcesoKg:flow.total_proceso_kg, mermaKg:flow.merma_kg,
    frioKg:flow.frio_kg, totalFletes:flow.total_fletes_dinero,
    ingresoFrutaDetalle:flow.ingreso_fruta_detalle, cargasDetalle:flow.cargas_detalle,
  };
}

export async function withLiveClosing(closing) {
  const start = dateKey(closing.week_start_date);
  const end = dateKey(closing.week_end_date);
  if (!validWeek(start,end)) return closing;
  const flow = await getWeeklySummary(start,end);
  const totals = closingTotals(closingForm(flow,getManualRent(closing),getExtraordinaryEntries(closing)));
  return {
    ...closing, total_cargas_kg:flow.total_cargas_kg, total_cargas_dinero:flow.total_cargas_dinero,
    total_ingresos_dinero:totals.ingresos, total_egresos_dinero:totals.egresos, resultado_dinero:totals.resultado,
    total_ventas_desecho_dinero:flow.total_ventas_desecho_dinero, total_ventas_proceso_dinero:flow.total_ventas_proceso_dinero,
    total_gastos:money(flow.total_gastos+flow.otros_fijos+flow.luz_automatica+(getManualRent(closing) ?? flow.renta_automatica)),
    inventario_frio_kg:flow.frio_kg, cargas_detalle:flow.cargas_detalle, recalculado:true,
  };
}
