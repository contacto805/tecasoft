import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { calculateIntegralLotCost, calculateUtility, calculateMargin } from "@/app/api/utils/financial-engine";

import {closingForm, getManualRent, getWeeklySummary, withLiveClosing} from "@/app/api/utils/weekly-summary";
import {closingTotals, closingWeek, dateKey, validWeek} from "@/utils/closing-period";
import {getExtraordinaryEntries, normalizeExtraordinaryEntries, sameExtraordinaryEntries} from "@/utils/closing-extraordinary";

// Core integral calculator - queries ONLY confirmed source tables. No duplication.
function toNum(v) { return (v == null || isNaN(parseFloat(v))) ? 0 : parseFloat(v); }

async function calcularCierreIntegral(startDate, endDate) {
  const [weekStart, weekEnd] = [startDate, endDate];

  // =====================
  // PESTAÑA 1: PRODUCCIÓN (confirmed sources)
  // =====================
  const prodRecibidos = await sql`
    SELECT 
      COALESCE(SUM(fiw.total_kg_weighed), 0) as kg_recibidos,
      COUNT(DISTINCT fiw.lot_id) as lotes_recibidos
    FROM fruit_input_weighings fiw
    WHERE fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const prodLotif = await sql`
    SELECT 
      COALESCE(SUM(psd.kg_a), 0) as calidad_a,
      COALESCE(SUM(psd.kg_b), 0) as calidad_b,
      COALESCE(SUM(pb.process_kg), 0) as proceso,
      COALESCE(SUM(pb.desecho_kg), 0) as desecho,
      COALESCE(SUM(pb.merma_kg), 0) as merma,
      COALESCE(SUM(psd.total_kg), 0) as total_lotificado
    FROM production_batches pb
    LEFT JOIN LATERAL (
      SELECT SUM(total_kg) AS total_kg,
        SUM(total_kg) FILTER (WHERE class_name IN ('A','SUPER','EXTRA','PRIMERA')) AS kg_a,
        SUM(total_kg) FILTER (WHERE class_name IN ('B','MEDIANO','TERCERA','CUARTA')) AS kg_b
      FROM production_selection_details WHERE production_batch_id = pb.id
    ) psd ON true
    WHERE pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
      AND COALESCE(pb.status, 'CONFIRMADO') != 'BORRADOR'
  `;

  const tarimasProd = await sql`
    SELECT COALESCE(SUM(pallet_count), 0) as tarimas, COALESCE(SUM(total_kg), 0) as kg_tarimas
    FROM pallet_output_summary
    WHERE packing_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const rendimientoPorLote = await sql`
    SELECT 
      l.id, l.lot_number, l.producer,
      COALESCE(fiw.total_kg_weighed, 0) as kg_recibidos,
      COALESCE(SUM(psd.total_kg), 0) as kg_lotificado,
      COALESCE(SUM(psd.kg_a), 0) as a,
      COALESCE(SUM(pb.process_kg),0) as proceso,
      COALESCE(SUM(pb.desecho_kg),0) as desecho,
      COALESCE(SUM(pb.merma_kg),0) as merma
    FROM lots l
    LEFT JOIN LATERAL (
      SELECT sum(total_kg_weighed) AS total_kg_weighed, min(public_scale_date) AS public_scale_date
      FROM fruit_input_weighings WHERE lot_id = l.id AND public_scale_date BETWEEN ${weekStart} AND ${weekEnd}
    ) fiw ON true
    LEFT JOIN production_batches pb ON pb.lot_id = l.id AND pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
    LEFT JOIN LATERAL (
      SELECT SUM(total_kg) AS total_kg,
        SUM(total_kg) FILTER (WHERE class_name IN ('A','SUPER','EXTRA','PRIMERA')) AS kg_a,
        SUM(total_kg) FILTER (WHERE class_name IN ('B','MEDIANO','TERCERA','CUARTA')) AS kg_b
      FROM production_selection_details WHERE production_batch_id = pb.id
    ) psd ON true
    WHERE (fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd} OR pb.production_date BETWEEN ${weekStart} AND ${weekEnd})
    GROUP BY l.id, l.lot_number, l.producer, fiw.total_kg_weighed
    ORDER BY kg_recibidos DESC LIMIT 30
  `;

  // =====================
  // PESTAÑA 2: INVENTARIOS (formula exacta)
  // =====================
  // Fruit inventory movements (approximate using pallet + loads)
  const invFruta = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN packing_date < ${weekStart} AND COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA') THEN total_kg ELSE 0 END), 0) as inicial,
      COALESCE(SUM(CASE WHEN packing_date BETWEEN ${weekStart} AND ${weekEnd} THEN total_kg ELSE 0 END), 0) as entradas,
      COALESCE(SUM(CASE WHEN embarque_id IS NOT NULL AND packing_date BETWEEN ${weekStart} AND ${weekEnd} THEN total_kg ELSE 0 END), 0) as salidas
    FROM pallet_output_summary
  `;

  const invFinalFruta = Math.max(0, parseFloat(invFruta[0]?.inicial || 0) + parseFloat(invFruta[0]?.entradas || 0) - parseFloat(invFruta[0]?.salidas || 0));

  // Materials - EXACT FORMULA from spec
  const matMov = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN created_at::date < ${weekStart} THEN quantity_available * COALESCE(costo_promedio, cost_per_unit, 0) ELSE 0 END), 0) as valor_inicial,
      COALESCE(SUM(quantity_available), 0) as unidades_inicial
    FROM materials_inventory
  `;

  // Entradas (purchases/receptions during week even if not paid)
  const matEntradas = await sql`
    SELECT COALESCE(SUM(pr.quantity_received * COALESCE(mi.cost_per_unit, 0)), 0) as valor_entradas
    FROM purchase_receptions pr
    JOIN purchase_orders po ON po.id = pr.purchase_order_id
    JOIN materials_inventory mi ON mi.id = CASE WHEN po.product_or_service ~ '^[0-9]{1,9}$' THEN po.product_or_service::int END OR mi.material_name ILIKE '%' || po.product_or_service || '%'
    WHERE pr.reception_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  // Consumos (material_deductions + bitacora during week)
  const matConsumos = await sql`
    SELECT COALESCE(SUM(md.quantity_used * COALESCE(md.costo_unitario_aplicado, mi.cost_per_unit, 0)), 0) as valor_consumos
    FROM material_deductions md
    JOIN materials_inventory mi ON mi.id = md.material_id
    JOIN production_batches pb ON pb.id = md.production_batch_id
    WHERE pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const matAjustes = await sql`SELECT COALESCE(SUM(ABS(valor_nuevo - valor_anterior)), 0) as ajustes FROM bitacora_auditoria_insumos WHERE timestamp::date BETWEEN ${weekStart} AND ${weekEnd}`;

  const valorInicialMat = parseFloat(matMov[0]?.valor_inicial || 0);
  const entradasMat = parseFloat(matEntradas[0]?.valor_entradas || 0);
  const consumosMat = parseFloat(matConsumos[0]?.valor_consumos || 0);
  const ajustesMat = parseFloat(matAjustes[0]?.ajustes || 0);

  // EXACT FORMULA
  const invFinalMaterial = valorInicialMat + entradasMat - consumosMat + ajustesMat;

  const tarimasDisp = await sql`
    SELECT COALESCE(SUM(pallet_count),0) as disp FROM pallet_output_summary 
    WHERE COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA') AND packing_date <= ${weekEnd}
  `;
  const tarimasEmbarc = await sql`
    SELECT COALESCE(SUM(pallet_count),0) as embarc FROM pallet_output_summary 
    WHERE estado = 'EMBARCADA' AND packing_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  // =====================
  // PESTAÑA 3: COSTOS Y GASTOS
  // =====================
  const costoFruta = await sql`
    SELECT COALESCE(SUM(fiw.total_kg_weighed * COALESCE(l.fruit_price, l.applied_purchase_price_mxn_kg, 0)), 0) as costo
    FROM fruit_input_weighings fiw JOIN lots l ON l.id=fiw.lot_id
    WHERE fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const costosCuadrilla = await sql`
    SELECT COALESCE(SUM(payable_kg * COALESCE(applied_crew_rate, 1.4)), 0) as total
    FROM cutting_orders WHERE cutting_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const fletesComerciales = await sql`SELECT COALESCE(SUM(price),0) AS total FROM crew_freights WHERE freight_date BETWEEN ${weekStart} AND ${weekEnd}`;

  const materialesConsumidosCosto = consumosMat; // same as above

  const nomina = await sql`SELECT COALESCE(SUM(net_salary),0) AS total FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.payroll_period_id WHERE pp.week_start_date >= ${weekStart} AND pp.week_end_date <= ${weekEnd}`;

  const gastosBancarios = await sql`
    SELECT COALESCE(SUM(charge),0) AS total FROM bank_movements bm
    JOIN bank_statements bs ON bs.id=bm.statement_id
    WHERE bm.movement_date BETWEEN ${weekStart} AND ${weekEnd} AND (bm.category ILIKE '%comision%' OR bm.description ILIKE '%comision%')
  `;

  const otrosGastos = await sql`SELECT COALESCE(SUM(amount_mxn),0) AS total FROM operating_costs WHERE cost_date BETWEEN ${weekStart} AND ${weekEnd} AND cost_category NOT IN ('produccion','compra_inventario')`;

  // =====================
  // PESTAÑA 4: BANCOS Y COBRANZA (integrates FASE 07)
  // =====================
  const bankWeek = await sql`
    SELECT 
      COALESCE(SUM(credit),0) as abonos,
      COALESCE(SUM(charge),0) as cargos,
      COUNT(*) as total_mov
    FROM bank_movements bm
    JOIN bank_statements bs ON bs.id = bm.statement_id
    WHERE bm.movement_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const cobrosClientes = await sql`SELECT COALESCE(SUM(equivalente_usd),0) AS total FROM abonos WHERE fecha BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosProductores = await sql`SELECT COALESCE(SUM(monto_pagado),0) AS total FROM payment_schedule WHERE paid_at::date BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosProveedores = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM producer_payments WHERE actual_payment_date BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosFletes = fletesComerciales; // reuse

  // =====================
  // PESTAÑA 5: RENTABILIDAD (usando MOTOR FINANCIERO CENTRALIZADO V9)
  // =====================
  const [salesOperation] = await sql`
    SELECT COALESCE(SUM(CASE WHEN h.currency='MXN' THEN h.total_amount
      WHEN h.currency='USD' AND r.fx>0 THEN round((h.total_amount * r.fx)::numeric,2) END),0) AS mxn,
      COUNT(*) FILTER (WHERE h.currency IS NULL OR h.currency NOT IN ('MXN','USD')
        OR (h.currency='USD' AND COALESCE(r.fx,0)<=0)) AS pendientes
    FROM load_history h LEFT JOIN LATERAL (
      SELECT ca.exchange_rate AS fx FROM customer_accounts ca JOIN load_history linked
        ON linked.id::text=ca.trip_reference_id::text
      WHERE ca.trip_type='load' AND ca.transaction_type='receivable' AND ca.exchange_rate>0
        AND (linked.id=h.id OR (NULLIF(h.factura_folio,'') IS NOT NULL AND linked.factura_folio=h.factura_folio))
      ORDER BY ca.id LIMIT 1
    ) r ON true
    WHERE h.load_date BETWEEN ${weekStart} AND ${weekEnd}
      AND lower(COALESCE(h.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado')
      AND NOT EXISTS (SELECT 1 FROM notas n WHERE n.folio=h.factura_folio AND lower(COALESCE(n.estatus,'')) IN ('cancelado','cancelada','cancelled','canceled','anulado'))
  `;
  const ingresosNetos = toNum(salesOperation.mxn);

  // Costo de ventas via motor (histórico por lote) - NUNCA estimado 65%
  // Si no hay datos suficientes para calcular costo real, se marca explícitamente como PENDIENTE
  let costoVentas = 0;
  let costoVentasPendiente = false;
  try {
    const loads = await sql`SELECT ld.lot_id, SUM(ld.total_kg) AS total_kg FROM load_details ld JOIN load_history lh ON lh.id=ld.load_id WHERE lh.load_date BETWEEN ${weekStart} AND ${weekEnd}
      AND lower(COALESCE(lh.payment_status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','anulado')
      AND NOT EXISTS (SELECT 1 FROM notas n WHERE n.folio=lh.factura_folio AND lower(COALESCE(n.estatus,'')) IN ('cancelado','cancelada','cancelled','canceled','anulado'))
      GROUP BY ld.lot_id`;
    for (const l of loads) {
      if (l.lot_id) {
        const c = await calculateIntegralLotCost(l.lot_id);
        if (c && c.costo_kg_comercializable > 0) {
          costoVentas += (toNum(l.total_kg) || 0) * c.costo_kg_comercializable;
        } else {
          costoVentasPendiente = true;
        }
      }
    }
  } catch (_) {
    costoVentasPendiente = true;
  }
  costoVentas = parseFloat(costoVentas.toFixed(2));
  const costoVentasLabel = costoVentasPendiente && costoVentas === 0 ? 'COSTO PENDIENTE DE DETERMINACIÓN' : String(costoVentas);

  const utilidadBruta = calculateUtility(ingresosNetos, { costo_ventas: costoVentas }, 'bruta');
  const margenBruto = calculateMargin(utilidadBruta, ingresosNetos);

  // =====================
  // PESTAÑA 6: CONCILIACIÓN (9 comparisons)
  // =====================
  const conc = {
    ingreso_vs_produccion: Math.abs(parseFloat(prodRecibidos[0]?.kg_recibidos || 0) - toNum(ingresosNetos)),
    produccion_vs_inventarios: Math.abs(parseFloat(prodLotif[0]?.total_lotificado || 0) - parseFloat(invFruta[0]?.entradas || 0)),
    inventarios_vs_embarques: Math.abs(parseFloat(invFinalFruta) - parseFloat(tarimasEmbarc[0]?.embarc || 0)),
    ventas_vs_cobranza: Math.abs(toNum(ingresosNetos) - parseFloat(cobrosClientes[0]?.total || 0)),
    obligaciones_vs_pagos: Math.abs(parseFloat(pagosProductores[0]?.total || 0) + parseFloat(pagosProveedores[0]?.total || 0) - parseFloat(pagosFletes[0]?.total || 0)),
  };

  return {
    produccion: {
      kg_recibidos: parseFloat(prodRecibidos[0]?.kg_recibidos || 0),
      kg_lotificados: parseFloat(prodLotif[0]?.total_lotificado || 0),
      calidad_a: parseFloat(prodLotif[0]?.calidad_a || 0),
      calidad_b: parseFloat(prodLotif[0]?.calidad_b || 0),
      proceso: parseFloat(prodLotif[0]?.proceso || 0),
      desecho: parseFloat(prodLotif[0]?.desecho || 0),
      merma: parseFloat(prodLotif[0]?.merma || 0),
      tarimas_producidas: parseFloat(tarimasProd[0]?.tarimas || 0),
      rendimiento_lotes: rendimientoPorLote,
    },
    inventarios: {
      fruta_inicial: parseFloat(invFruta[0]?.inicial || 0),
      fruta_entradas: parseFloat(invFruta[0]?.entradas || 0),
      fruta_salidas: parseFloat(invFruta[0]?.salidas || 0),
      fruta_final: invFinalFruta,
      tarimas_disponibles: parseFloat(tarimasDisp[0]?.disp || 0),
      tarimas_embarcadas: parseFloat(tarimasEmbarc[0]?.embarc || 0),
      materiales_inicial: valorInicialMat,
      materiales_entradas: entradasMat,
      materiales_consumidos: consumosMat,
      materiales_ajustes: ajustesMat,
      materiales_final: invFinalMaterial,
      formula_materiales: "INICIAL + ENTRADAS - CONSUMOS + AJUSTES",
    },
    costos_gastos: {
      costo_efectivo_fruta: parseFloat(costoFruta[0]?.costo || 0),
      cuadrillas: parseFloat(costosCuadrilla[0]?.total || 0),
      fletes_comerciales: parseFloat(fletesComerciales[0]?.total || 0),
      materiales_consumidos: materialesConsumidosCosto,
      nomina: parseFloat(nomina[0]?.total || 0),
      gastos_bancarios: parseFloat(gastosBancarios[0]?.total || 0),
      otros: parseFloat(otrosGastos[0]?.total || 0),
    },
    bancos_cobranza: {
      abonos_banco: parseFloat(bankWeek[0]?.abonos || 0),
      cargos_banco: parseFloat(bankWeek[0]?.cargos || 0),
      cobros_clientes: parseFloat(cobrosClientes[0]?.total || 0),
      pagos_productores: parseFloat(pagosProductores[0]?.total || 0),
      pagos_proveedores: parseFloat(pagosProveedores[0]?.total || 0),
      total_movimientos: parseFloat(bankWeek[0]?.total_mov || 0),
    },
    rentabilidad: {
      ingresos_netos: ingresosNetos,
      ventas_sin_conversion: toNum(salesOperation.pendientes),
      costo_ventas: costoVentas,
      costo_ventas_label: costoVentasLabel,
      costo_ventas_pendiente: costoVentasPendiente,
      utilidad_bruta: utilidadBruta,
      margen_bruto: margenBruto || 0,
      fuente: "financial-engine (centralizado V9) - sin estimaciones automáticas",
      nota: costoVentasPendiente ? 'Algunos costos de venta usan costo histórico real; faltan datos para lotes sin costo calculado.' : null
    },
    conciliacion: {
      comparaciones: conc,
      diferencias: Object.keys(conc).map(k => ({ clave: k, valor: conc[k] })),
      estado_general: Object.values(conc).every(v => v < 500) ? 'conciliado' : 'pendiente_revision',
    },
    meta: { calculado_en: new Date().toISOString(), fuentes: 'confirmed modules only' }
  };
}

// GET: list all closings or get summary data for a date range
export async function GET(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary");

    if (summary === "true") {
      if (!validWeek(startDate,endDate)) return NextResponse.json({error:"Selecciona un período de lunes a domingo."},{status:400});
      const flow = await getWeeklySummary(startDate,endDate);
      const [stored] = await sql`SELECT id, status, porcentaje_renta, detalle_integral, total_ingresos_dinero,
        total_egresos_dinero, resultado_dinero FROM weekly_closings
        WHERE id = ${flow.closing_id}`;
      let supplemental = {};
      if (searchParams.get("live") !== "true") {
        try { supplemental = await calcularCierreIntegral(startDate,endDate); }
        catch (error) {
          console.error("Detalle integral no disponible:",error);
          supplemental = {detalle_pendiente:true};
        }
      }
      const rent = getManualRent(stored);
      const live = closingTotals(closingForm(flow,rent,getExtraordinaryEntries(stored)));
      return NextResponse.json({
        ...supplemental, ...flow, renta_manual:rent, totales_vivos:live,
        guardado:stored && {
          id:stored.id, estado:stored.status, ingresos:stored.total_ingresos_dinero,
          egresos:stored.total_egresos_dinero, resultado:stored.resultado_dinero,
        },
        conciliacion: {
          estado_general: Math.abs(live.kilosPendientes) <= 5 && !flow.origen.embarques_sin_recepcion.length &&
            !flow.origen.ventas_pendientes_mxn.length && !flow.origen.lotes.some(lot => lot.cost == null) &&
            !flow.movimientos_mxn.some(row => row.amount == null)
            ? 'conciliado' : 'pendiente_revision',
          diferencias: [{clave:'Kilos recibidos sin aplicación o diferencia física',valor:live.kilosPendientes}],
        },
      }, {headers:{"Cache-Control":"no-store"}});
    }

    // List all closings
    const closings = await sql`
      SELECT * FROM weekly_closings ORDER BY week_start_date DESC
    `;
    const {start,end} = closingWeek();
    const position = closings.findIndex(closing => dateKey(closing.week_start_date) === start && dateKey(closing.week_end_date) === end);
    const active = position < 0 ? {id:null,week_start_date:start,week_end_date:end,
      week_label:`Semana ${start}`,status:'abierto',virtual:true} : closings.splice(position,1)[0];
    closings.unshift(await withLiveClosing(active));
    return NextResponse.json(closings, {headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Error fetching weekly closings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create a new closing
async function prepareClosing(input, existing = null) {
  const start = existing ? dateKey(existing.week_start_date) : input.weekStartDate;
  const end = existing ? dateKey(existing.week_end_date) : input.weekEndDate;
  if (!validWeek(start,end)) return {error:"El cierre debe cubrir de lunes a domingo."};
  const manual = Object.hasOwn(input,'porcentajeRenta')
    ? (input.porcentajeRenta === '' || input.porcentajeRenta == null ? null : Number(input.porcentajeRenta))
    : getManualRent(existing);
  if (manual !== null && (!Number.isFinite(manual) || manual < 0 || manual > 1000000000)) {
    return {error:"Renta manual inválida."};
  }
  let extraordinary = getExtraordinaryEntries(existing);
  if (Object.hasOwn(input,'conceptosExtraordinarios')) {
    try { extraordinary = normalizeExtraordinaryEntries(input.conceptosExtraordinarios); }
    catch (error) { return {error:error.message}; }
  }
  const flow = await getWeeklySummary(start,end);
  return {
    ...input, ...closingForm(flow,manual,extraordinary), weekStartDate:start, weekEndDate:end,
    weekLabel:input.weekLabel ?? existing?.week_label ?? `Semana ${start}`,
    status:input.status ?? existing?.status ?? 'abierto', notes:input.notes ?? existing?.notes ?? null,
    bancos:input.bancos ?? existing?.bancos ?? 0,
    efectivoDisponible:input.efectivoDisponible ?? existing?.efectivo_disponible ?? 0,
    detalle_integral:{...flow,renta_manual:manual,conceptos_extraordinarios:extraordinary,calculado_en:new Date().toISOString()},
  };
}

export async function POST(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
    const body = await prepareClosing(await request.json());
    if (body.error) return NextResponse.json({error:body.error},{status:400});
    const {
      weekStartDate, weekEndDate, weekLabel,
      totalCargasDinero, totalVentasDesechoDinero, totalVentasProcesoDinero,
      valorInventarioMateriales, bancos, inventarioTarimas, efectivoDisponible,
      totalGastos, totalEntradasFrutaDinero, totalCuadrillaDinero, totalBrokerNotes,
      nominaSemanal, porcentajeRenta, porcentajeLuz,
      totalCargasKg, totalCuadrillaKg, totalEntradasFrutaKg, totalDesechoKg, totalProcesoKg,
      totalFletes, ingresoFrutaDetalle, cargasDetalle, notes, status,
    } = body;

    const totals = closingTotals(body);
    const inventarioTarimasJson = JSON.stringify(inventarioTarimas);

    const detalleIntegral = body.detalle_integral || body.detalleIntegral || null;
    const estadoConc = body.estado_conciliacion || body.estadoConciliacion || (status === 'cerrado' ? 'cerrado' : 'borrador');

    const [, result] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext(${'weekly-closing:' + weekStartDate}))`,
      sql`
      INSERT INTO weekly_closings (
        week_start_date, week_end_date, week_label,
        total_cargas_dinero, total_ventas_desecho_dinero, total_ventas_proceso_dinero,
        valor_inventario_materiales, bancos, inventario_tarimas, efectivo_disponible,
        total_gastos, total_entradas_fruta_dinero, total_cuadrilla_dinero, total_broker_notes,
        nomina_semanal, porcentaje_renta, porcentaje_luz,
        total_cargas_kg, total_cuadrilla_kg, total_entradas_fruta_kg, total_desecho_kg, total_proceso_kg,
        total_fletes_dinero,
        ingreso_fruta_detalle,
        cargas_detalle,
        total_ingresos_dinero, total_egresos_dinero, resultado_dinero,
        total_ingresos_kg, total_egresos_kg, resultado_kg,
        status, notes, estado_conciliacion, detalle_integral, snapshot_cierre
      ) SELECT
        ${weekStartDate}::date, ${weekEndDate}::date, ${weekLabel || null},
        ${parseFloat(totalCargasDinero) || 0}, ${parseFloat(totalVentasDesechoDinero) || 0}, ${parseFloat(totalVentasProcesoDinero) || 0},
        ${parseFloat(valorInventarioMateriales) || 0}, ${parseFloat(bancos) || 0}, ${inventarioTarimasJson}::jsonb, ${parseFloat(efectivoDisponible) || 0},
        ${parseFloat(totalGastos) || 0}, ${parseFloat(totalEntradasFrutaDinero) || 0}, ${parseFloat(totalCuadrillaDinero) || 0}, ${parseFloat(totalBrokerNotes) || 0},
        ${parseFloat(nominaSemanal) || 0}, ${parseFloat(porcentajeRenta) || 0}, ${parseFloat(porcentajeLuz) || 0},
        ${parseFloat(totalCargasKg) || 0}, ${parseFloat(totalCuadrillaKg) || 0}, ${parseFloat(totalEntradasFrutaKg) || 0}, ${parseFloat(totalDesechoKg) || 0}, ${parseFloat(totalProcesoKg) || 0},
        ${parseFloat(totalFletes) || 0},
        ${JSON.stringify(ingresoFrutaDetalle)}::jsonb,
        ${JSON.stringify(cargasDetalle)}::jsonb,
        ${totals.ingresos}, ${totals.egresos}, ${totals.resultado},
        ${totalEntradasFrutaKg}, ${totals.salidas}, ${totals.kilosPendientes},
        ${status || 'abierto'}, ${notes || null},
        ${estadoConc},
        ${JSON.stringify(detalleIntegral)}::jsonb,
        CASE WHEN ${status} = 'cerrado' THEN ${JSON.stringify(detalleIntegral)}::jsonb END
      WHERE NOT EXISTS (
        SELECT 1 FROM weekly_closings WHERE week_start_date=${weekStartDate}::date
           AND week_end_date=${weekEndDate}::date)
      RETURNING *
    `]);
    if (!result.length) return NextResponse.json({error:"La semana ya tiene un cierre guardado."},{status:409});

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating weekly closing:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: update an existing closing
export async function PUT(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
    const input = await request.json();
    if (!/^\d+$/.test(String(input.id))) return NextResponse.json({error:"Selecciona un cierre guardado."},{status:400});
    const [existing] = await sql`SELECT * FROM weekly_closings WHERE id = ${input.id}`;
    if (!existing) return NextResponse.json({error:"Cierre no encontrado."},{status:404});
    if (existing.status === 'cerrado' && input.status !== 'abierto') {
      return NextResponse.json({error:"Reabre el cierre para modificar la captura manual."},{status:409});
    }
    const previousEntries = getExtraordinaryEntries(existing);
    if (Object.hasOwn(input,'conceptosExtraordinarios')) {
      const unchanged = sameExtraordinaryEntries(previousEntries,input.conceptosExtraordinariosPrevios);
      if (!unchanged) return NextResponse.json({error:"Los conceptos cambiaron. Vuelve a abrir el cierre antes de guardar."},{status:409});
      if (['cerrado','aprobado'].includes(existing.status)) {
        return NextResponse.json({error:"Reabre el cierre antes de editar los conceptos extraordinarios."},{status:409});
      }
    }
    const body = await prepareClosing(input,existing);
    if (body.error) return NextResponse.json({error:body.error},{status:400});
    const {
      id, weekStartDate, weekEndDate, weekLabel,
      totalCargasDinero, totalVentasDesechoDinero, totalVentasProcesoDinero,
      valorInventarioMateriales, bancos, inventarioTarimas, efectivoDisponible,
      totalGastos, totalEntradasFrutaDinero, totalCuadrillaDinero, totalBrokerNotes,
      nominaSemanal, porcentajeRenta, porcentajeLuz,
      totalCargasKg, totalCuadrillaKg, totalEntradasFrutaKg, totalDesechoKg, totalProcesoKg,
      totalFletes, ingresoFrutaDetalle, cargasDetalle, status, notes,
    } = body;

    const totals = closingTotals(body);
    const inventarioTarimasJson = JSON.stringify(inventarioTarimas);

    const detalleIntegral = body.detalle_integral || body.detalleIntegral || null;
    const estadoConc = body.estado_conciliacion || body.estadoConciliacion || (status === 'cerrado' ? 'cerrado' : null);

    const result = await sql`
      UPDATE weekly_closings SET
        week_start_date = ${weekStartDate},
        week_end_date = ${weekEndDate},
        week_label = ${weekLabel || null},
        total_cargas_dinero = ${parseFloat(totalCargasDinero) || 0},
        total_ventas_desecho_dinero = ${parseFloat(totalVentasDesechoDinero) || 0},
        total_ventas_proceso_dinero = ${parseFloat(totalVentasProcesoDinero) || 0},
        valor_inventario_materiales = ${parseFloat(valorInventarioMateriales) || 0},
        bancos = ${parseFloat(bancos) || 0},
        inventario_tarimas = ${inventarioTarimasJson},
        efectivo_disponible = ${parseFloat(efectivoDisponible) || 0},
        total_gastos = ${parseFloat(totalGastos) || 0},
        total_entradas_fruta_dinero = ${parseFloat(totalEntradasFrutaDinero) || 0},
        total_cuadrilla_dinero = ${parseFloat(totalCuadrillaDinero) || 0},
        total_broker_notes = ${parseFloat(totalBrokerNotes) || 0},
        nomina_semanal = ${parseFloat(nominaSemanal) || 0},
        porcentaje_renta = ${parseFloat(porcentajeRenta) || 0},
        porcentaje_luz = ${parseFloat(porcentajeLuz) || 0},
        total_cargas_kg = ${parseFloat(totalCargasKg) || 0},
        total_cuadrilla_kg = ${parseFloat(totalCuadrillaKg) || 0},
        total_entradas_fruta_kg = ${parseFloat(totalEntradasFrutaKg) || 0},
        total_desecho_kg = ${parseFloat(totalDesechoKg) || 0},
        total_proceso_kg = ${parseFloat(totalProcesoKg) || 0},
        total_fletes_dinero = ${parseFloat(totalFletes) || 0},
        ingreso_fruta_detalle = ${ingresoFrutaDetalle ? JSON.stringify(ingresoFrutaDetalle) : null},
        cargas_detalle = ${cargasDetalle ? JSON.stringify(cargasDetalle) : null},
        total_ingresos_dinero = ${totals.ingresos},
        total_egresos_dinero = ${totals.egresos},
        resultado_dinero = ${totals.resultado},
        total_ingresos_kg = ${totalEntradasFrutaKg},
        total_egresos_kg = ${totals.salidas},
        resultado_kg = ${totals.kilosPendientes},
        status = ${status || 'abierto'},
        notes = ${notes || null},
        estado_conciliacion = COALESCE(${estadoConc}, estado_conciliacion),
        detalle_integral = COALESCE(${detalleIntegral ? JSON.stringify(detalleIntegral) : null}::jsonb, detalle_integral),
        snapshot_cierre = CASE WHEN ${status || 'abierto'} = 'cerrado' THEN COALESCE(${detalleIntegral ? JSON.stringify(detalleIntegral) : null}::jsonb, snapshot_cierre) ELSE snapshot_cierre END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
        AND status IS NOT DISTINCT FROM ${existing.status ?? null}
        AND COALESCE(detalle_integral->'conceptos_extraordinarios','[]'::jsonb) = ${JSON.stringify(previousEntries)}::jsonb
      RETURNING *
    `;

    if (!result.length) return NextResponse.json({error:"El cierre cambió. Vuelve a abrirlo antes de guardar."},{status:409});
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating weekly closing:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    await sql`DELETE FROM weekly_closings WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
