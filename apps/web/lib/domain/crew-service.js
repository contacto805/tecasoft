import sql from "@/app/api/utils/sql";

/**
 * Crew domain service - SINGLE SOURCE OF TRUTH for cuadrillas.
 * All kg come from cutting_orders (net_weight + fruit_input_weighings real).
 * Tariffs frozen per cut via applied_crew_rate.
 * Payments = payable_kg * applied_rate (pure per-kg, no worker fallback).
 * Adjustments never overwrite originals.
 */

export async function getDefaultCrewRate() {
  try {
    const [row] = await sql`
      SELECT value FROM system_settings WHERE key = 'crew_default_rate_per_kg' LIMIT 1
    `;
    return parseFloat(row?.value || 1.40);
  } catch (e) {
    return 1.40;
  }
}

// Pure formula from spec: IMPORTE = KG_PAGABLES × TARIFA_APLICADA
export function calculateCrewPay({ kg = 0, rate = 1.40 }) {
  const k = parseFloat(String(kg)) || 0;
  const r = parseFloat(String(rate)) || 1.40;
  return parseFloat((k * r).toFixed(2));
}

export async function getCutsForWeek(weekStart, weekEnd) {
  // Master kg: prefer fruit_input_weighings (real weighed), then net_weight on order
  const cuts = await sql`
    SELECT 
      co.*,
      l.lot_number,
      COALESCE(
        (SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id = co.lot_id LIMIT 1),
        co.net_weight,
        (SELECT SUM(w.net_weight) FROM weighings w WHERE w.lot_id = co.lot_id)
      ) AS real_kg,
      c.nombre as crew_nombre,
      c.clave as crew_clave,
      c.tarifa_default_por_kg as crew_default_rate,
      co.applied_crew_rate as applied_rate
    FROM cutting_orders co
    LEFT JOIN lots l ON l.id = co.lot_id
    LEFT JOIN crews c ON c.id = co.crew_id
    WHERE co.cutting_date BETWEEN ${weekStart} AND ${weekEnd}
    ORDER BY co.cutting_date ASC, co.folio ASC
  `;
  return cuts;
}

export async function getDailySummary(weekStart, weekEnd) {
  const rows = await sql`
    SELECT 
      co.cutting_date as day,
      co.crew_id,
      COALESCE(c.nombre, co.crew_chief_name, 'Sin asignar') as crew_name,
      COUNT(*) as cortes,
      COALESCE(SUM(
        COALESCE(
          (SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id=co.lot_id LIMIT 1),
          co.net_weight
        )
      ), 0) as kg,
      COALESCE(SUM(co.payable_kg), 0) as payable_kg,
      COALESCE(SUM(co.applied_crew_rate * COALESCE(co.payable_kg, 
        (SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id=co.lot_id LIMIT 1),
        co.net_weight
      )), 0) as crew_amount
    FROM cutting_orders co
    LEFT JOIN crews c ON c.id = co.crew_id
    WHERE co.cutting_date BETWEEN ${weekStart} AND ${weekEnd}
    GROUP BY co.cutting_date, co.crew_id, crew_name
    ORDER BY day ASC
  `;
  return rows;
}

export async function getCrewWeeklySummary(weekStart, weekEnd) {
  const rows = await sql`
    SELECT 
      COALESCE(c.id, 0) as crew_id,
      COALESCE(c.nombre, co.crew_chief_name, 'Sin asignar') as crew_name,
      COUNT(*) as cortes,
      COALESCE(SUM(
        COALESCE((SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id=co.lot_id LIMIT 1), co.net_weight)
      ),0) as kg_originales,
      COALESCE(SUM(co.adjustment_kg),0) as ajustes,
      COALESCE(SUM(co.payable_kg),0) as kg_pagables,
      COALESCE(AVG(co.applied_crew_rate), (SELECT value::numeric FROM system_settings WHERE key='crew_default_rate_per_kg' LIMIT 1)) as tarifa_promedio,
      COALESCE(SUM(co.applied_crew_rate * COALESCE(co.payable_kg, 
        (SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id = co.lot_id LIMIT 1), co.net_weight )), 0) as importe_cuadrilla
    FROM cutting_orders co
    LEFT JOIN crews c ON c.id = co.crew_id
    WHERE co.cutting_date BETWEEN ${weekStart} AND ${weekEnd}
    GROUP BY c.id, crew_name
    ORDER BY importe_cuadrilla DESC
  `;
  return rows;
}

export async function assignCrewToCut({ cutting_order_id, crew_id, justification = null, user = 'sistema' }) {
  const [order] = await sql`SELECT * FROM cutting_orders WHERE id = ${parseInt(cutting_order_id)} LIMIT 1`;
  if (!order) throw new Error('Orden no encontrada');

  const [crew] = await sql`SELECT * FROM crews WHERE id = ${parseInt(crew_id)} LIMIT 1`;
  const rate = crew ? parseFloat(crew.tarifa_default_por_kg || 0) : await getDefaultCrewRate();
  const finalRate = rate > 0 ? rate : await getDefaultCrewRate();

  await sql`
    UPDATE cutting_orders 
    SET 
      crew_id = ${parseInt(crew_id)},
      crew_chief_name = ${crew ? crew.nombre : order.crew_chief_name},
      applied_crew_rate = ${finalRate},
      kg_original = COALESCE(kg_original, net_weight),
      payable_kg = COALESCE(payable_kg, net_weight),
      updated_at = NOW()
    WHERE id = ${parseInt(cutting_order_id)}
  `;

  await sql`
    INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_id, user_name, module, reference, notes, created_at)
    VALUES ('cutting_order', ${parseInt(cutting_order_id)}, ${order.lot_id}, 'CREW_ASSIGNED', 0, 0, 0, 'unidad', ${user}, ${user}, 'cuadrillas', ${order.folio}, ${'Cuadrilla asignada: ' + (crew?.nombre || '') + ' @ ' + finalRate})
  `;

  return { success: true, applied_rate: finalRate };
}

export async function adjustCutKg({ cutting_order_id, adjustment_kg, tipo_ajuste, justificacion, evidence_url = null, usuario = 'sistema' }) {
  const id = parseInt(cutting_order_id);
  const [order] = await sql`SELECT * FROM cutting_orders WHERE id = ${id} LIMIT 1`;
  if (!order) throw new Error('Orden no encontrada');

  const kgOriginal = parseFloat(order.kg_original || order.net_weight || 0);
  const adj = parseFloat(adjustment_kg || 0);
  const newPayable = Math.max(0, kgOriginal + adj);

  // Never overwrite original
  await sql`
    UPDATE cutting_orders 
    SET 
      adjustment_kg = ${adj},
      payable_kg = ${newPayable},
      kg_original = COALESCE(kg_original, net_weight),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO crew_cut_adjustments (
      cutting_order_id, crew_id, kg_originales, adjustment_kg, kg_resultantes, tipo_ajuste, justificacion, evidence_url, usuario
    ) VALUES (
      ${id}, ${order.crew_id}, ${kgOriginal}, ${adj}, ${newPayable}, ${tipo_ajuste}, ${justificacion}, ${evidence_url}, ${usuario}
    )
  `;

  await sql`
    INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_id, user_name, module, reference, notes, created_at)
    VALUES ('cutting_order', ${id}, ${order.lot_id}, 'CREW_ADJUST', ${kgOriginal}, ${adj}, ${newPayable}, 'kg', ${usuario}, ${usuario}, 'cuadrillas', ${order.folio}, ${justificacion || ''})
  `;

  return { success: true, payable_kg: newPayable, kg_original: kgOriginal };
}

export async function calculateCutCost(cut) {
  const kg = parseFloat(cut.payable_kg || cut.real_kg || cut.net_weight || 0);
  const rate = parseFloat(cut.applied_crew_rate || cut.crew_default_rate || await getDefaultCrewRate());
  const crewPay = calculateCrewPay({ kg, rate });

  const freight = parseFloat(cut.applied_freight_amount || cut.freight_cost || 0);

  return {
    crew_pay: crewPay,
    freight_cost: freight,
    total_cost: parseFloat((crewPay + freight).toFixed(2)),
    kg_pagables: kg,
    rate_used: rate
  };
}

export async function getTarifario() {
  return await sql`
    SELECT fr.*, vt.nombre as vehicle_type_name 
    FROM freight_rates fr
    LEFT JOIN freight_vehicle_types vt ON vt.id = fr.vehicle_type_id
    WHERE COALESCE(fr.active, true) = true
    ORDER BY fr.origin, fr.destination
  `;
}

export async function assignFreightToCut({ cutting_order_id, freight_rate_id = null, origin, destination, vehicle_type_id, applied_rate, manual_reason = null, user = 'sistema' }) {
  const id = parseInt(cutting_order_id);
  const [order] = await sql`SELECT * FROM cutting_orders WHERE id = ${id} LIMIT 1`;
  if (!order) throw new Error('Orden no encontrada');

  const rateSource = freight_rate_id ? 'TARIFF' : 'MANUAL';

  await sql`
    UPDATE cutting_orders 
    SET 
      freight_origin = ${origin || null},
      freight_destination = ${destination || null},
      applied_freight_amount = ${parseFloat(applied_rate)},
      freight_rate_id = ${freight_rate_id ? parseInt(freight_rate_id) : null},
      rate_source = ${rateSource},
      distance_km = COALESCE(${parseFloat(String(origin ? 0 : 0))}, distance_km),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO cut_freights (cutting_order_id, lot_id, rate_type, freight_rate_id, vehicle_type_id, origin, destination, applied_rate, manual_reason, status, created_by)
    VALUES (${id}, ${order.lot_id}, ${rateSource}, ${freight_rate_id ? parseInt(freight_rate_id) : null}, ${vehicle_type_id ? parseInt(vehicle_type_id) : null}, ${origin}, ${destination}, ${parseFloat(applied_rate)}, ${manual_reason}, 'ASIGNADO', ${user})
  `;

  return { success: true };
}

export async function authorizeCut({ cutting_order_id, user = 'sistema' }) {
  const id = parseInt(cutting_order_id);
  const [order] = await sql`SELECT * FROM cutting_orders WHERE id = ${id} LIMIT 1`;
  if (!order) throw new Error('Orden no encontrada');

  await sql`
    UPDATE cutting_orders 
    SET status_crew = 'AUTORIZADO', updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, user_id, user_name, module, reference, notes)
    VALUES ('cutting_order', ${id}, ${order.lot_id}, 'CREW_AUTHORIZED', ${user}, ${user}, 'cuadrillas', ${order.folio}, 'Corte autorizado - kg y tarifas congelados')
  `;

  return { success: true };
}

export async function createCrewPayment({ crew_id, week_start_date, week_end_date, user = 'sistema' }) {
  const summary = await getCrewWeeklySummary(week_start_date, week_end_date);
  const crewSummary = summary.find(s => parseInt(s.crew_id) === parseInt(crew_id)) || { cortes: 0, kg_pagables: 0, importe_cuadrilla: 0, tarifa_promedio: 0 };

  const [payment] = await sql`
    INSERT INTO crew_payments (
      folio, week_start_date, week_end_date, crew_id, total_cuts, total_kg_pagables, total_amount, applied_rate, status, paid_by
    ) VALUES (
      'PCUA-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      ${week_start_date}, ${week_end_date}, ${parseInt(crew_id)},
      ${crewSummary.cortes}, ${crewSummary.kg_pagables}, ${crewSummary.importe_cuadrilla},
      ${crewSummary.tarifa_promedio}, 'PENDIENTE', ${user}
    ) RETURNING *
  `;

  return payment;
}
