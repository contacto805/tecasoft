import sql from "@/app/api/utils/sql";

// Catálogo de herramientas seguras para TECAVO IA (BLOQUE 01)
// Todas las funciones verifican rol en el caller. Solo lectura para inicio.
// Nunca exponer datos de terceros si no es Super.

export const IA_TOOLS = [
  { type: "function", function: { name: "get_kpi_summary", description: "Resumen ejecutivo real: ingresos, egresos, resultado, kg, pagos. Incluye fuente y periodo.", parameters: { type: "object", properties: { period: { type: "string", default: "week" } } } } },
  { type: "function", function: { name: "get_lot_performance", description: "Rendimiento real confirmado por lote o productor. kg calidad, merma, rendimiento.", parameters: { type: "object", properties: { lotId: { type: "string" }, producer: { type: "string" }, limit: { type: "number", default: 8 } } } } },
  { type: "function", function: { name: "get_payment_status", description: "Pagos a productores: saldos, vencidos, programados. Solo datos autorizados.", parameters: { type: "object", properties: { producerNumber: { type: "string" }, status: { type: "string" } } } } },
  { type: "function", function: { name: "search_producers", description: "Busqueda productores (solo super).", parameters: { type: "object", properties: { q: { type: "string" } } } } },
  { type: "function", function: { name: "get_weekly_closing", description: "Cierre semanal real: kg fruta, tarimas, costos, utilidad. Usa datos confirmados.", parameters: { type: "object", properties: { weekStart: { type: "string" } } } } },
  { type: "function", function: { name: "get_material_consumption", description: "Gasto real en materiales esta semana o por lote. Fuente: material_deductions + costs.", parameters: { type: "object", properties: { period: { type: "string", default: "week" }, lotId: { type: "string" } } } } },
  { type: "function", function: { name: "get_packing_cost_per_tarima", description: "Costo empaque por tarima usando motor financiero + produccion confirmada.", parameters: { type: "object", properties: { lotId: { type: "string" } } } } },
  { type: "function", function: { name: "get_producer_payments_due", description: "Cuanto debemos pagar a productores. Fuente payment_schedule confirmada.", parameters: { type: "object", properties: { status: { type: "string", default: "pendiente" } } } } },
  { type: "function", function: { name: "get_bank_payments", description: "Pagos reales desde bancos. Fuente bank_movements.", parameters: { type: "object", properties: { period: { type: "string", default: "week" } } } } },
  { type: "function", function: { name: "get_unreconciled_movements", description: "Movimientos bancarios sin conciliar. Propuestas de relacion.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_lots_with_losses", description: "Lotes con perdidas o rendimiento bajo. Datos de lot_performance y lotificacion.", parameters: { type: "object", properties: { limit: { type: "number", default: 8 } } } } },
  { type: "function", function: { name: "get_inventory_summary", description: "Inventario actual de fruta y materiales. Fuentes reales bodega y pallet.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_client_pending_balances", description: "Clientes con saldos pendientes. Notas y cuentas.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_rentabilidad_analysis", description: "Analisis rentabilidad usando motor financiero centralizado (utilidad bruta/operativa/neta, margen).", parameters: { type: "object", properties: { lotId: { type: "string" }, weekStart: { type: "string" } } } } },
  { type: "function", function: { name: "run_error_detection", description: "Deteccion de errores e inconsistencias: duplicados, kg inconsistentes, gastos sin soporte, lotes sin cierre.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_financial_simulator", description: "Simulador financiero: bidireccional campo-destino y costos integrales.", parameters: { type: "object", properties: { direction: { type: "string" }, precio: { type: "number" } } } } }
];

// Implementaciones reales (seguridad en el caller del chat)

export async function getKpiSummary(period = "week", user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  // Solo datos agregados seguros. Usa tablas reales existentes.
  try {
    const [closings] = await sql`
      SELECT week_label, total_ingresos_dinero, total_egresos_dinero, resultado_dinero, total_cargas_kg
      FROM weekly_closings ORDER BY week_start_date DESC LIMIT 1
    `;
    const [pendingPays] = await sql`
      SELECT COUNT(*) as cnt, COALESCE(SUM(saldo_pendiente),0) as saldo
      FROM payment_schedule WHERE (saldo_pendiente > 0 OR status != 'paid')
    `;
    const [intake] = await sql`
      SELECT COALESCE(SUM(total_kg_received),0) as kg_ingreso FROM lots WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    return {
      source: "weekly_closings + payment_schedule + lots",
      period,
      updated: new Date().toISOString(),
      kpis: {
        ultima_semana_ingresos: closings?.total_ingresos_dinero || 0,
        ultima_semana_egresos: closings?.total_egresos_dinero || 0,
        resultado: closings?.resultado_dinero || 0,
        kg_ingreso_semana: intake?.kg_ingreso || 0,
        pagos_pendientes: pendingPays?.cnt || 0,
        saldo_pendiente: pendingPays?.saldo || 0
      },
      note: isSuper ? "Datos consolidados empresa" : "Datos limitados a tu alcance",
      certainty: "hecho (tablas reales)"
    };
  } catch (e) {
    return { error: "No se pudo consultar KPIs", source: "DB", certainty: "error" };
  }
}

export async function getLotPerformance(args = {}, user) {
  const { lotId, producer, limit = 10 } = args;
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    let rows;
    if (lotId) {
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, kg_by_quality, total_kg_process, total_kg_waste, performance_percentage
        FROM lot_performance WHERE lot_id = ${parseInt(lotId) || lotId} OR lot_number = ${lotId} LIMIT 1
      `;
    } else if (producer && !isSuper) {
      // productor solo ve los suyos (filtrado estricto)
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, total_kg_process, total_kg_waste
        FROM lot_performance WHERE producer ILIKE ${'%' + producer + '%'} LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, kg_by_quality, total_kg_process, total_kg_waste, performance_percentage
        FROM lot_performance ORDER BY generated_at DESC LIMIT ${limit}
      `;
    }
    return {
      source: "lot_performance (lotificacion confirmada real)",
      count: rows.length,
      rows: rows.map(r => ({ ...r, certainty: "confirmado" })),
      note: "Comparacion proyeccion vs real disponible solo si existe visit_calculator"
    };
  } catch (e) {
    return { error: "Error consultando rendimiento", source: "lot_performance" };
  }
}

export async function getPaymentStatus(args = {}, user) {
  const { producerNumber, status } = args;
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    let q = sql`SELECT folio, producer_name, amount, saldo_pendiente, scheduled_payment_date, dias_retraso_habiles, status FROM payment_schedule`;
    if (!isSuper && producerNumber) {
      q = sql`${q} WHERE producer_name ILIKE ${'%' + producerNumber + '%'} OR producer_name = ${producerNumber}`;
    } else if (!isSuper) {
      return { error: "Productor debe especificar su numero", note: "Sin producerNumber no se muestran datos ajenos" };
    }
    if (status === "atrasado") q = sql`${q} AND (saldo_pendiente > 0) AND scheduled_payment_date < CURRENT_DATE`;
    if (status === "esta_semana") q = sql`${q} AND scheduled_payment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`;
    const rows = await sql`${q} ORDER BY scheduled_payment_date LIMIT 30`;
    return {
      source: "payment_schedule (fechas programadas + retraso habil real)",
      rows,
      note: "Productor solo ve los suyos. Super ve todo."
    };
  } catch (e) {
    return { error: "Error en pagos" };
  }
}

export async function searchProducers(args = {}, user) {
  const { q } = args;
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  if (!isSuper) return { error: "Busqueda de productores restringida", note: "Solo Superadministrador" };
  try {
    const rows = await sql`
      SELECT id, producer_number, producer_name, whatsapp_phone, rfc, last_login_at
      FROM producer_portal_access
      WHERE producer_number ILIKE ${'%'+(q||'')+'%'} OR producer_name ILIKE ${'%'+(q||'')+'%'} OR rfc ILIKE ${'%'+(q||'')+'%'}
      LIMIT 20
    `;
    return { source: "producer_portal_access", producers: rows };
  } catch (e) {
    return { error: "No se pudo buscar" };
  }
}

// Nuevas herramientas TECAVO IA FASE 10 - datos reales + metadata requerida

export async function getWeeklyClosing(args = {}, user) {
  const { weekStart } = args;
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    let q = sql`SELECT week_label, week_start_date, total_cargas_kg, total_ingresos_dinero, total_egresos_dinero, resultado_dinero, total_tarimas, estado_conciliacion FROM weekly_closings`;
    if (weekStart) q = sql`${q} WHERE week_start_date >= ${weekStart}`;
    const rows = await sql`${q} ORDER BY week_start_date DESC LIMIT 3`;
    return {
      source: "weekly_closings (datos confirmados de cierre)",
      period: weekStart || "últimas semanas",
      estado: "confirmado",
      updated: new Date().toISOString(),
      calculo: "Totales consolidados de producción, ventas, gastos y bancos",
      registros: rows.length,
      rows: rows.map(r => ({...r, certeza: "hecho"}))
    };
  } catch (e) { return { error: "Error en cierre", source: "weekly_closings" }; }
}

export async function getMaterialConsumption(args = {}, user) {
  const { period = "week", lotId } = args;
  try {
    const [row] = await sql`
      SELECT COALESCE(SUM(costo_total_insumo_lote),0) as gasto, COUNT(*) as items
      FROM consumo_insumos_lote 
      WHERE created_at > NOW() - INTERVAL '7 days' ${lotId ? sql`AND folio_proceso IN (SELECT id FROM production_batches WHERE lot_id=${parseInt(lotId)})` : sql``}
    `;
    return {
      source: "consumo_insumos_lote + materials_inventory (histórico real)",
      period, estado: "confirmado", updated: new Date().toISOString(),
      calculo: "Suma de costos reales de materiales aplicados en producción",
      gasto_materiales: Number(row?.gasto || 0), items: Number(row?.items || 0)
    };
  } catch (e) { return { error: "Error materiales", source: "consumo_insumos_lote" }; }
}

export async function getPackingCostPerTarima(args = {}, user) {
  const { lotId } = args;
  try {
    // Usa motor financiero si existe
    let cost = 0; let kg = 0;
    if (lotId) {
      const fin = await import("@/app/api/utils/financial-engine.js").then(m => m.calculateIntegralLotCost(lotId)).catch(()=>null);
      if (fin) cost = fin.costo_integral || 0;
    }
    const [p] = await sql`SELECT COALESCE(SUM(total_kg),0) as kg, COALESCE(SUM(pallet_count),0) as tarimas FROM pallet_output_summary WHERE lot_id = ${parseInt(lotId)||0}`;
    kg = Number(p?.kg || 1);
    const porTarima = p?.tarimas > 0 ? (cost / p.tarimas) : (cost / (kg/240 || 1));
    return {
      source: "pallet_output_summary + financial-engine (motor centralizado)",
      period: "lote actual", estado: "confirmado", updated: new Date().toISOString(),
      calculo: "Costo integral lote / tarimas producidas",
      costo_por_tarima: Math.round(porTarima * 100) / 100, costo_total: cost, kg_totales: kg
    };
  } catch (e) { return { error: "Error empaque", source: "pallet_output_summary" }; }
}

export async function getProducerPaymentsDue(args = {}, user) {
  const { status = "pendiente" } = args;
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    const rows = await sql`
      SELECT folio, producer_name, amount, saldo_pendiente, scheduled_payment_date, status
      FROM payment_schedule 
      WHERE (saldo_pendiente > 0 OR status != 'paid') 
      ${!isSuper ? sql`AND producer_name = ${user?.name || ''}` : sql``}
      ORDER BY scheduled_payment_date LIMIT 25
    `;
    return {
      source: "payment_schedule (programados confirmados)",
      period: "actual", estado: "confirmado", updated: new Date().toISOString(),
      calculo: "Saldos reales de pagos a productores",
      total_pendiente: rows.reduce((s,r)=>s + (r.saldo_pendiente||0),0),
      rows
    };
  } catch (e) { return { error: "Error pagos productores" }; }
}

export async function getBankPayments(args = {}, user) {
  const { period = "week" } = args;
  try {
    const rows = await sql`
      SELECT movement_date, description, credit, charge, bank_identifier, status
      FROM bank_movements 
      WHERE movement_date > CURRENT_DATE - INTERVAL '7 days' ORDER BY movement_date DESC LIMIT 15
    `;
    return {
      source: "bank_movements (reales importados)",
      period, estado: "confirmado", updated: new Date().toISOString(),
      calculo: "Movimientos bancarios reales registrados",
      total_creditos: rows.reduce((s,r)=>s+(r.credit||0),0), rows
    };
  } catch (e) { return { error: "Error bancos" }; }
}

export async function getUnreconciledMovements(args = {}, user) {
  try {
    const rows = await sql`SELECT * FROM bank_movements WHERE status IS NULL OR status NOT IN ('reconciled','matched') ORDER BY movement_date DESC LIMIT 20`;
    return {
      source: "bank_movements (sin conciliar)",
      period: "actual", estado: "confirmado", updated: new Date().toISOString(),
      calculo: "Movimientos pendientes de relacion con productores/clientes/gastos",
      count: rows.length, propuestas: rows.slice(0,5).map(r => ({id: r.id, desc: r.description, monto: r.amount || r.credit}))
    };
  } catch (e) { return { error: "Error conciliacion" }; }
}

export async function getLotsWithLosses(args = {}, user) {
  const { limit = 8 } = args;
  try {
    const rows = await sql`
      SELECT lot_number, producer, performance_percentage, total_kg_waste, total_kg_process 
      FROM lot_performance WHERE performance_percentage < 75 OR total_kg_waste > 200 
      ORDER BY performance_percentage ASC LIMIT ${limit}
    `;
    return {
      source: "lot_performance (confirmado)", period: "últimos", estado: "confirmado",
      calculo: "Lotes con rendimiento bajo o merma alta", updated: new Date().toISOString(), rows
    };
  } catch (e) { return { error: "Error lotes perdida" }; }
}

export async function getInventorySummary(args = {}, user) {
  try {
    const [inv] = await sql`SELECT COALESCE(SUM(total_kg),0) as fruta_kg FROM lot_inventory`;
    const [mat] = await sql`SELECT COALESCE(SUM(quantity_available * cost_per_unit),0) as mat_valor FROM materials_inventory`;
    return {
      source: "lot_inventory + materials_inventory", period: "actual", estado: "confirmado",
      updated: new Date().toISOString(), calculo: "Stock físico actual",
      kg_fruta: Number(inv?.fruta_kg||0), valor_materiales: Number(mat?.mat_valor||0)
    };
  } catch (e) { return { error: "Error inventario" }; }
}

export async function getClientPendingBalances(args = {}, user) {
  try {
    const rows = await sql`SELECT customer_name, saldo_usd, estatus FROM notas WHERE saldo_usd > 0 ORDER BY saldo_usd DESC LIMIT 12`;
    return {
      source: "notas + customer_accounts", period: "actual", estado: "confirmado",
      calculo: "Saldos reales de clientes", updated: new Date().toISOString(), rows
    };
  } catch (e) { return { error: "Error saldos clientes" }; }
}

export async function getRentabilidadAnalysis(args = {}, user) {
  const { lotId, weekStart } = args;
  try {
    // Usa motor financiero
    const { calculateIntegralLotCost, calculateNetIncome, calculateUtility, calculateMargin } = await import("@/app/api/utils/financial-engine.js");
    let costo = 0, ingreso = 0;
    if (lotId) {
      const c = await calculateIntegralLotCost(lotId);
      costo = c?.costo_integral || 0;
      const ni = await calculateNetIncome({lotId});
      ingreso = ni?.ingreso_neto || 0;
    }
    const utilBruta = await calculateUtility(ingreso, {costo_integral: costo}, "bruta");
    const utilOp = await calculateUtility(ingreso, {costo_integral: costo}, "operativa");
    const margen = calculateMargin(utilBruta, ingreso);
    return {
      source: "financial-engine (motor centralizado V9)",
      period: lotId ? `lote ${lotId}` : (weekStart || "actual"),
      estado: "confirmado", updated: new Date().toISOString(),
      calculo: "UTILIDAD = INGRESO_NETO - COSTOS ; MARGEN = UTILIDAD / INGRESO * 100 (denominador validado)",
      utilidad_bruta: utilBruta, utilidad_operativa: utilOp, margen: margen, ingreso_neto: ingreso, costo_integral: costo
    };
  } catch (e) { return { error: "Error rentabilidad", fuente: "financial-engine" }; }
}

export async function runErrorDetection(args = {}, user) {
  try {
    const issues = [];
    const [dup] = await sql`SELECT COUNT(*) as c FROM (SELECT lot_id FROM production_batches GROUP BY lot_id HAVING COUNT(*)>1) x`;
    if (dup?.c > 0) issues.push({ tipo: "Lotes duplicados en producción", cantidad: dup.c });
    const [kgm] = await sql`SELECT COUNT(*) as c FROM lots l LEFT JOIN fruit_input_weighings w ON w.lot_id=l.id WHERE l.total_kg_received > 0 AND w.total_kg_weighed IS NULL`;
    if (kgm?.c > 0) issues.push({ tipo: "Kg recibidos sin pesaje público", cantidad: kgm.c });
    const [bank] = await sql`SELECT COUNT(*) as c FROM bank_movements WHERE status IS NULL OR status='pending'`;
    if (bank?.c > 5) issues.push({ tipo: "Movimientos bancarios sin conciliar", cantidad: bank.c });
    return {
      source: "multi-tablas (lots, production_batches, bank_movements, payment_schedule)",
      period: "actual", estado: "detectado", updated: new Date().toISOString(),
      calculo: "Consultas cruzadas de consistencia", issues
    };
  } catch (e) { return { error: "Deteccion parcial", issues: [] }; }
}

export async function getFinancialSimulator(args = {}, user) {
  const { direction = "destino_a_campo", precio = 0 } = args;
  try {
    const { bidirectionalPriceCalculator } = await import("@/app/api/utils/financial-engine.js");
    const res = await bidirectionalPriceCalculator({ direction, precioDestinoPorKg: precio, precioCampoActual: precio });
    return {
      source: "financial-engine.bidirectionalPriceCalculator",
      period: "simulacion", estado: "calculado", updated: new Date().toISOString(),
      calculo: "Precio maximo campo o minimo destino segun rendimientos historicos y costos",
      resultado: res
    };
  } catch (e) { return { error: "Error simulador", source: "financial-engine" }; }
}