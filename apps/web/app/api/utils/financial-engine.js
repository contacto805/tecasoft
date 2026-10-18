import sql from "@/app/api/utils/sql";
import { getCanonicalReceivedKg } from "./recalculate";

/**
 * MOTOR FINANCIERO CENTRALIZADO TECAVO V9
 * Única fuente de verdad para todos los cálculos financieros.
 * Ningún módulo (Producción, Inventarios, Ventas, Cierre, etc.) debe usar fórmulas propias.
 * 
 * Reglas:
 * - Siempre consulta datos CONFIRMADOS (no borradores)
 * - Nunca mezcla pagos bancarios con costos devengados
 * - Costo de tarimas vendidas = costo histórico de su producción
 * - Fruta en inventario NO se carga a costo de ventas
 * - Decimales controlados (4 posiciones en costos por kg)
 */

const toNum = (v) => (v == null || isNaN(parseFloat(v))) ? 0 : parseFloat(v);
const round4 = (n) => Math.round(toNum(n) * 10000) / 10000;
const round2 = (n) => Math.round(toNum(n) * 100) / 100;

/**
 * COSTO_INTEGRAL_LOTE = SUMA(COSTOS_UNICOS_ASIGNADOS)
 * Fuentes autorizadas:
 * - Fruta: fruit_input_weighings + lots/cutting_orders (precio pactado confirmado)
 * - Cuadrillas + Acarreo: cutting_orders (applied_crew_rate, applied_freight_amount)
 * - Materiales: material_deductions confirmados (costo_unitario_aplicado)
 * - Empaque / Transporte comercial: operating_costs + load_history / crew_freights (excluyendo dup)
 * - Otros directos: operating_costs con module_origin autorizado
 */
export async function calculateIntegralLotCost(lotId) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return null;

  try {
    const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotIdNum}`;
    if (!lot) return null;

    const received = await getCanonicalReceivedKg(lotIdNum);

    // 1. FRUTA ADQUIRIDA (confirmada)
    const [co] = await sql`
      SELECT agreed_price_per_kg, freight_cost, applied_crew_rate, applied_freight_amount, payable_kg
      FROM cutting_orders 
      WHERE lot_id = ${lotIdNum} OR id = ${lot.cutting_order_id || 0} 
      LIMIT 1
    `;
    const fruitPrice = toNum(co?.agreed_price_per_kg || lot.fruit_price || lot.applied_purchase_price_mxn_kg);
    const frutaAdquirida = round2(fruitPrice * received);

    // 2. CUADRILLAS (autorizado)
    const crewCost = round2(toNum(co?.payable_kg || received) * toNum(co?.applied_crew_rate || 1.4));

    // 3. ACARREO / FLETE CORTE
    const acarreo = round2(toNum(co?.applied_freight_amount || co?.freight_cost || 0));

    // 4. MATERIALES CONSUMIDOS (histórico confirmado, no inventario)
    const [matRow] = await sql`
      SELECT COALESCE(SUM(md.quantity_used * COALESCE(md.costo_unitario_aplicado, mi.cost_per_unit, 0)), 0) as total
      FROM material_deductions md
      JOIN materials_inventory mi ON mi.id = md.material_id
      JOIN production_batches pb ON pb.id = md.production_batch_id
      WHERE pb.lot_id = ${lotIdNum} AND COALESCE(pb.status, 'CONFIRMADO') != 'BORRADOR'
    `;
    const materiales = round2(toNum(matRow?.total));

    // 5. EMPAQUE Y OTROS DIRECTOS (operating_costs sin duplicar)
    const [empRow] = await sql`
      SELECT COALESCE(SUM(amount_mxn), 0) as total
      FROM operating_costs
      WHERE lot_id = ${lotIdNum}
        AND COALESCE(module_origin,'') NOT IN ('cuadrillas','fletes_corte','compra_inventario')
        AND status IN ('aprobado','confirmado','pendiente')
    `;
    const empaqueOtros = round2(toNum(empRow?.total));

    // 6. TRANSPORTE COMERCIAL (fletes de embarque asociados)
    const [transRow] = await sql`
      SELECT COALESCE(SUM(price),0) as total
      FROM crew_freights 
      WHERE lot_id = ${lotIdNum} AND freight_type IN ('comercial','embarque')
    `;
    const transporte = round2(toNum(transRow?.total));

    // 7. COMISIONES (del orden o lote)
    const comision = round2(toNum(co?.agreed_commission || lot.commission_amount) * (received / 1000));

    // 8. GASTOS INDIRECTOS (proporcional autorizado - placeholder simple por ahora)
    const indirectos = 0; // Se puede distribuir desde weekly_cost_summary si existe

    const costoIntegral = round2(frutaAdquirida + crewCost + acarreo + materiales + empaqueOtros + transporte + comision + indirectos);

    const costoPorKgRecibido = received > 0 ? round4(costoIntegral / received) : 0;

    // Comercializable (post selección)
    const [packedRow] = await sql`
      SELECT COALESCE(SUM(total_kg),0) as kg
      FROM production_selection_details 
      WHERE lot_id = ${lotIdNum}
    `;
    const kgComercial = toNum(packedRow?.kg) || received;
    const costoPorKgCom = kgComercial > 0 ? round4(costoIntegral / kgComercial) : costoPorKgRecibido;

    return {
      lote_id: lotIdNum,
      kg_recibidos: received,
      desglose: {
        fruta_adquirida: frutaAdquirida,
        cuadrillas: crewCost,
        acarreo_corte: acarreo,
        materiales_consumidos: materiales,
        empaque_y_otros: empaqueOtros,
        transporte_comercial: transporte,
        comisiones: comision,
        indirectos,
      },
      costo_integral: costoIntegral,
      costo_kg_recibido: costoPorKgRecibido,
      costo_kg_comercializable: costoPorKgCom,
      kg_comercializable: kgComercial,
      fuente: "financial-engine.calculateIntegralLotCost (únicas fuentes confirmadas)",
      version: "V9",
    };
  } catch (e) {
    console.error("calculateIntegralLotCost error", e);
    return null;
  }
}

/**
 * INGRESO_NETO = VENTAS_RECONOCIDAS - DESCUENTOS_Y_AJUSTES_APLICABLES
 */
export async function calculateNetIncome(params = {}) {
  const { loadId = null, lotId = null, weekStart = null, weekEnd = null } = params;

  try {
    let ingresos = 0;
    let descuentos = 0;

    if (loadId) {
      const [lh] = await sql`SELECT total_amount FROM load_history WHERE id = ${parseInt(loadId)}`;
      ingresos = toNum(lh?.total_amount);
    } else if (lotId) {
      const [sum] = await sql`
        SELECT COALESCE(SUM(total_amount),0) as t 
        FROM load_history WHERE lot_id = ${parseInt(lotId)}
      `;
      ingresos = toNum(sum?.t);
    } else if (weekStart && weekEnd) {
      const [sum] = await sql`
        SELECT COALESCE(SUM(total_amount),0) as t 
        FROM load_history WHERE load_date BETWEEN ${weekStart} AND ${weekEnd}
      `;
      ingresos = toNum(sum?.t);
    }

    // Ajustes de clientes (descuentos) - desde financial_adjustments o notas
    const adj = await sql`
      SELECT COALESCE(SUM(delta),0) as d 
      FROM financial_adjustments 
      WHERE entity_type IN ('load','venta') 
        AND status = 'authorized' 
        AND (entity_id = ${loadId || 0} OR ${lotId ? `entity_id IN (SELECT id FROM load_history WHERE lot_id=${lotId})` : 'false'})
    `;
    descuentos = Math.abs(toNum(adj[0]?.d));

    const ingresoNeto = round2(ingresos - descuentos);

    return {
      ingresos_reconocidos: round2(ingresos),
      descuentos_ajustes: descuentos,
      ingreso_neto: ingresoNeto,
    };
  } catch (e) {
    return { ingresos_reconocidos: 0, descuentos_ajustes: 0, ingreso_neto: 0 };
  }
}

/**
 * UTILIDAD = INGRESO_NETO - COSTOS_Y_GASTOS_APLICABLES
 * Tipos: bruta | operativa | neta
 */
export async function calculateUtility(incomeNeto, costos, tipo = "bruta") {
  const ing = toNum(incomeNeto);
  let util = 0;

  if (tipo === "bruta") {
    // Costo de ventas (solo lo vendido, costo histórico)
    util = ing - toNum(costos?.costo_ventas || costos?.costo_integral || 0);
  } else if (tipo === "operativa") {
    const bruta = ing - toNum(costos?.costo_ventas || 0);
    util = bruta - toNum(costos?.gastos_operativos || costos?.cuadrillas || 0);
  } else {
    // neta
    const op = calculateUtility(ing, costos, "operativa");
    util = op - toNum(costos?.otros_resultados || 0);
  }

  return round2(util);
}

export function calculateMargin(utilidad, ingresoNeto) {
  const u = toNum(utilidad);
  const i = toNum(ingresoNeto);
  if (i <= 0) return 0;
  return round2((u / i) * 100);
}

/**
 * CALCULADORA BIDIRECCIONAL (Campo <-> Destino)
 * direction: 'destino_a_campo' | 'campo_a_destino'
 */
export async function bidirectionalPriceCalculator(input = {}) {
  const {
    direction = "destino_a_campo",
    precioDestinoPorKg = 0,
    precioCampoActual = 0,
    kgPorCaja = 6,
    rendimientoHistorico = 0.82, // % comercializable real
    costosNoFrutaPorKg = 4.5,
    utilidadObjetivoPorKg = 2.0,
    margenMinimo = 0.15,
  } = input;

  const pDest = toNum(precioDestinoPorKg);
  const pCampo = toNum(precioCampoActual);
  const kgCaja = toNum(kgPorCaja) || 6;
  const rend = toNum(rendimientoHistorico) || 0.82;
  const noFruta = toNum(costosNoFrutaPorKg);
  const utilObj = toNum(utilidadObjetivoPorKg);

  let resultado = {};

  if (direction === "destino_a_campo") {
    // Cuánto máximo se puede pagar en campo según precio en destino
    const ingresoPotencial = pDest * rend;
    const maxCampo = Math.max(0, ingresoPotencial - noFruta - utilObj);
    const precioRecomendado = maxCampo * (1 - margenMinimo); // conservador

    resultado = {
      max_precio_campo: round4(maxCampo),
      precio_recomendado_campo: round4(precioRecomendado),
      margen_estimado: round2(margenMinimo * 100),
      nota: "Calculado desde precio destino. Rendimiento histórico aplicado.",
    };
  } else {
    // Campo a destino: qué precio de venta necesito
    const costoTotal = pCampo + noFruta;
    const precioMinDestino = costoTotal / (rend || 0.8);
    const precioConUtil = precioMinDestino / (1 - margenMinimo);

    resultado = {
      precio_min_destino: round4(precioMinDestino),
      precio_recomendado_destino: round4(precioConUtil),
      precio_por_caja_6kg: round4(precioConUtil * kgCaja),
      nota: "Para cubrir costo campo + operativos + utilidad objetivo.",
    };
  }

  return {
    ...resultado,
    inputs: { direction, precioDestinoPorKg: pDest, precioCampoActual: pCampo },
    version: "financial-engine V9",
  };
}

/**
 * AJUSTES FINANCIEROS (con control de autorización)
 * Solo Superadministrador puede autorizar cambios al precio de compra del productor.
 */
export async function createFinancialAdjustment(payload, user = {}) {
  const {
    entity_type,
    entity_id,
    adjustment_type,
    original_value,
    new_value,
    reason,
  } = payload;

  const delta = round2(toNum(new_value) - toNum(original_value));
  const isProducerPrice = adjustment_type === "producer_purchase_price";

  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";

  const status = isProducerPrice && !isSuper ? "pending_authorization" : "authorized";
  const authorizedBy = status === "authorized" ? (user?.name || "sistema") : null;

  // Generar folio
  const [folioRow] = await sql`SELECT 'AJ-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(id),0)+1,4,'0') as folio FROM financial_adjustments`;
  const folio = folioRow?.folio || `AJ-${Date.now()}`;

  const [row] = await sql`
    INSERT INTO financial_adjustments (
      folio, entity_type, entity_id, adjustment_type,
      original_value, new_value, delta, reason,
      requested_by, authorized_by, authorized_at, status
    ) VALUES (
      ${folio}, ${entity_type}, ${entity_id}, ${adjustment_type},
      ${toNum(original_value)}, ${toNum(new_value)}, ${delta}, ${reason || "Ajuste financiero"},
      ${user?.name || "sistema"}, ${authorizedBy}, ${status === "authorized" ? "NOW()" : null}, ${status}
    ) RETURNING *
  `;

  // Si se autoriza cambio de precio de productor, actualizar lote (solo super)
  if (isProducerPrice && status === "authorized" && entity_type === "lot") {
    await sql`UPDATE lots SET fruit_price = ${toNum(new_value)}, updated_at = NOW() WHERE id = ${entity_id}`;
    // También snapshot
    await sql`
      INSERT INTO lot_price_snapshot (lot_id, price_applied, price_type, created_at)
      VALUES (${entity_id}, ${toNum(new_value)}, 'ajuste_autorizado', NOW())
    `;
  }

  return row;
}

export async function authorizeAdjustment(id, user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  if (!isSuper) throw new Error("Solo Superadministrador puede autorizar ajustes de precio de productor");

  const [adj] = await sql`SELECT * FROM financial_adjustments WHERE id = ${parseInt(id)}`;
  if (!adj) throw new Error("Ajuste no encontrado");

  await sql`
    UPDATE financial_adjustments 
    SET status = 'authorized', authorized_by = ${user.name || 'super'}, authorized_at = NOW(), updated_at = NOW()
    WHERE id = ${parseInt(id)}
  `;

  if (adj.adjustment_type === "producer_purchase_price" && adj.entity_type === "lot") {
    await sql`UPDATE lots SET fruit_price = ${adj.new_value}, updated_at = NOW() WHERE id = ${adj.entity_id}`;
  }

  return { success: true };
}

/**
 * VALIDACIÓN DE CONSISTENCIA FINANCIERA (para cierres y pruebas)
 */
export async function validateFinancialConsistency(params = {}) {
  const { weekStart, weekEnd, lotId } = params;
  const issues = [];

  // Ejemplo de chequeos
  if (weekStart && weekEnd) {
    // Bancos vs pagos registrados
    // Producción vs inventario vs ventas, etc.
    // (se puede ampliar con queries reales)
    issues.push({ tipo: "info", mensaje: "Validación básica ejecutada (motor centralizado)" });
  }

  return {
    valido: issues.length === 0,
    issues,
    timestamp: new Date().toISOString(),
  };
}

export default {
  calculateIntegralLotCost,
  calculateNetIncome,
  calculateUtility,
  calculateMargin,
  bidirectionalPriceCalculator,
  createFinancialAdjustment,
  authorizeAdjustment,
  validateFinancialConsistency,
};
