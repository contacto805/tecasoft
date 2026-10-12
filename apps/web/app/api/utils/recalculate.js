import sql from "@/app/api/utils/sql";

/**
 * Central movement logger - ensures every critical change has full traceability
 */
export async function logMovement({ entity_type, entity_id, lot_id, movement_type, qty_before = 0, qty = 0, qty_after = 0, unit = 'kg', location_from = null, location_to = null, user_id = 'sistema', user_name = 'Sistema', module = 'sistema', reference = null, notes = null }, { required = false } = {}) {
  try {
    await sql`
      INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, location_from, location_to, user_id, user_name, module, reference, notes, created_at)
      VALUES (${entity_type}, ${entity_id || null}, ${lot_id || null}, ${movement_type}, ${qty_before}, ${qty}, ${qty_after}, ${unit}, ${location_from}, ${location_to}, ${user_id}, ${user_name}, ${module}, ${reference}, ${notes}, CURRENT_TIMESTAMP)
    `;
  } catch (e) {
    if (required) throw e;
    /* non-fatal for informational logs */
  }
}

/**
 * SINGLE SOURCE OF TRUTH for received kg of a lot.
 * Priority:
 * 1. fruit_input_weighings.total_kg_weighed (validated public scale / reception)
 * 2. SUM(weighings.net_weight) as fallback for partial
 * 3. lots.total_kg_received as last cache (never authoritative alone)
 */
export async function getCanonicalReceivedKg(lotId) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return 0;

  try {
    // 1. Prefer validated fruit_input_weighings
    const [fiw] = await sql`
      SELECT COALESCE(SUM(total_kg_weighed), 0) as kg
      FROM fruit_input_weighings
      WHERE lot_id = ${lotIdNum}
    `;
    const fromFiw = parseFloat(fiw?.kg || 0);
    if (fromFiw > 0) return fromFiw;

    // 2. Fallback to individual weighings
    const [w] = await sql`
      SELECT COALESCE(SUM(net_weight), 0) as kg
      FROM weighings
      WHERE lot_id = ${lotIdNum}
    `;
    const fromWeighings = parseFloat(w?.kg || 0);
    if (fromWeighings > 0) return fromWeighings;

    // 3. Last resort from lot cache (may be stale)
    const [lot] = await sql`
      SELECT COALESCE(total_kg_received, 0) as kg FROM lots WHERE id = ${lotIdNum}
    `;
    return parseFloat(lot?.kg || 0);
  } catch (e) {
    console.error('getCanonicalReceivedKg error', e);
    return 0;
  }
}

/**
 * Rebuilds lot aggregates from the ground up from physical sources.
 * Single source for: received, packed, process, waste, shrinkage, inventory, sold.
 * Call this after any critical operation instead of incremental += .
 */
export async function recalculateLot(lotId) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return null;

  try {
    const canonicalReceived = await getCanonicalReceivedKg(lotIdNum);

    // Production outputs (packed = inventory ready, process, waste) - use batches for independent + details
    const prod = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN total_kg > 0 THEN total_kg ELSE 0 END), 0) as packed_kg
      FROM production_selection_details
      WHERE lot_id = ${lotIdNum}
    `;
    const packed = parseFloat(prod[0]?.packed_kg || 0);
    // process / waste / merma from confirmed batches (new columns)
    const batchAgg = await sql`
      SELECT 
        COALESCE(SUM(process_kg),0) as process_kg,
        COALESCE(SUM(desecho_kg),0) as waste_kg,
        COALESCE(SUM(merma_kg),0) as merma_kg
      FROM production_batches WHERE lot_id = ${lotIdNum} AND COALESCE(status,'CONFIRMADO') != 'BORRADOR'
    `;
    const processKg = parseFloat(batchAgg[0]?.process_kg || 0);
    const wasteKg = parseFloat(batchAgg[0]?.waste_kg || 0);

    // Merma / shrinkage = received - (packed + process + waste)
    const shrinkageKg = Math.max(0, canonicalReceived - packed - processKg - wasteKg);

    // Inventory current from tarimas (pallet_output_summary real_weight if present, else total_kg)
    // For compatibility use current pallet_output + lot_inventory as cache, but authoritative is tarimas
    const inv = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as inv_kg
      FROM pallet_output_summary
      WHERE lot_id = ${lotIdNum} AND COALESCE(estado, 'PENDIENTE_UBICACION') NOT IN ('EMBARCADA', 'CANCELADA')
    `;
    const currentInventoryKg = parseFloat(inv[0]?.inv_kg || 0);

    // Sold from loads
    const sold = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as sold_kg
      FROM load_history
      WHERE lot_id = ${lotIdNum}
    `;
    const soldKg = parseFloat(sold[0]?.sold_kg || 0);

    // Update the lot with rebuilt values (no +=)
    await sql`
      UPDATE lots SET
        total_kg_received = ${canonicalReceived},
        total_kg_packed = ${packed},
        total_kg_process = ${processKg},
        total_kg_waste = ${wasteKg},
        total_kg_inventory = ${currentInventoryKg},
        total_kg_sold = ${soldKg},
        updated_at = NOW()
      WHERE id = ${lotIdNum}
    `;

    await logMovement({
      entity_type: 'lot', entity_id: lotIdNum, lot_id: lotIdNum,
      movement_type: 'RECALC_LOT', qty_before: 0, qty: canonicalReceived,
      qty_after: packed + processKg + wasteKg + shrinkageKg,
      unit: 'kg', module: 'core', reference: 'recalculateLot',
      notes: `received=${canonicalReceived} packed=${packed} proc=${processKg} waste=${wasteKg} merma=${shrinkageKg}`
    });

    return { received: canonicalReceived, packed, process: processKg, waste: wasteKg, shrinkage: shrinkageKg, inventory: currentInventoryKg, sold: soldKg };
  } catch (e) {
    console.error('recalculateLot error', e);
    return null;
  }
}

/**
 * Validate physical balance for a lot.
 * packed + process + waste + shrinkage + pending == received (within tolerance)
 */
export async function validateLotBalance(lotId, tolerance = 5) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return { valid: false, diff: 9999 };

  const received = await getCanonicalReceivedKg(lotIdNum);

  const [agg] = await sql`
    SELECT COALESCE(SUM(total_kg),0) as packed
    FROM production_selection_details WHERE lot_id = ${lotIdNum}
  `;
  const packed = parseFloat(agg?.packed || 0);
  const [bagg] = await sql`
    SELECT COALESCE(SUM(process_kg),0) as proc, COALESCE(SUM(desecho_kg),0) as waste
    FROM production_batches WHERE lot_id = ${lotIdNum} AND COALESCE(status,'CONFIRMADO') != 'BORRADOR'
  `;
  const proc = parseFloat(bagg?.proc || 0);
  const waste = parseFloat(bagg?.waste || 0);

  const totalAccounted = packed + proc + waste;
  const diff = Math.abs(received - totalAccounted);

  return {
    valid: diff <= tolerance,
    received,
    packed,
    process: proc,
    waste,
    diff: parseFloat(diff.toFixed(2)),
    message: diff > tolerance ? `Diferencia de ${diff.toFixed(2)} kg` : 'Balance correcto'
  };
}

/**
 * Get current cold inventory kg from physical tarimas (pallet_output_summary as source of truth)
 */
export async function getLotInventoryFromPallets(lotId) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return 0;
  const [r] = await sql`
    SELECT COALESCE(SUM(total_kg), 0) as kg
    FROM pallet_output_summary
    WHERE lot_id = ${lotIdNum}
      AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA')
  `;
  return parseFloat(r?.kg || 0);
}

/**
 * RECALCULATE LOT PERFORMANCE + AGGREGATES
 * Real yield AFTER SELECTION and REAL COST after selection.
 */
export async function recalculateLotPerformance(lotId) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return null;

  try {
    const [lot] = await sql`
      SELECT 
        l.*,
        COALESCE(f.total_kg_weighed, 0) as public_scale_kg
      FROM lots l
      LEFT JOIN fruit_input_weighings f ON f.lot_id = l.id
      WHERE l.id = ${lotIdNum}
    `;
    if (!lot) return null;

    const production = await sql`
      SELECT 
        psd.caliber, psd.class_name,
        COALESCE(SUM(psd.total_kg), 0) as total_kg
      FROM production_selection_details psd
      WHERE psd.lot_id = ${lotIdNum}
      GROUP BY psd.caliber, psd.class_name
    `;

    const totalKgProduced = production.reduce((s, p) => s + parseFloat(p.total_kg || 0), 0);

    const publicScaleKg = parseFloat(lot.public_scale_kg || 0);
    const processKg = parseFloat(lot.total_kg_process || 0) || 0;
    const wasteKg = parseFloat(lot.total_kg_waste || 0) || 0;

    // KG DESPUÉS DE SELECCIÓN = producido (empacado) que es lo comercializable post-selección
    const kgAfterSelection = totalKgProduced;

    // % and maps
    const calibersKg = {};
    production.forEach(p => { const c = p.caliber || 'Sin calibre'; calibersKg[c] = (calibersKg[c]||0) + parseFloat(p.total_kg||0); });

    const performancePercentage = publicScaleKg > 0 ? parseFloat(((kgAfterSelection / publicScaleKg) * 100).toFixed(2)) : 0;
    const processPercentage = publicScaleKg > 0 ? parseFloat(((processKg / publicScaleKg) * 100).toFixed(2)) : 0;
    const wastePercentage = publicScaleKg > 0 ? parseFloat(((wasteKg / publicScaleKg) * 100).toFixed(2)) : 0;
    const shrinkageKg = Math.max(0, publicScaleKg - kgAfterSelection - processKg - wasteKg);

    // COSTO REAL DESPUÉS DE SELECCIÓN
    // costo fruta recibido + materiales + otros directos / kgAfterSelection
    const fruitCost = (parseFloat(lot.fruit_price || 0) * publicScaleKg);
    const [matCostRow] = await sql`
      SELECT COALESCE(SUM(md.quantity_used * mi.cost_per_unit), 0) as mat_cost
      FROM production_batches pb
      JOIN material_deductions md ON pb.id = md.production_batch_id
      JOIN materials_inventory mi ON md.material_id = mi.id
      WHERE pb.lot_id = ${lotIdNum}
    `;
    const materialsCost = parseFloat(matCostRow?.mat_cost || 0);
    const totalDirectCost = fruitCost + materialsCost;
    const realCostAfterSelection = kgAfterSelection > 0 ? parseFloat((totalDirectCost / kgAfterSelection).toFixed(4)) : 0;
    const purchaseCostPerKg = publicScaleKg > 0 ? parseFloat((fruitCost / publicScaleKg).toFixed(4)) : 0;

    const [existing] = await sql`SELECT id FROM lot_performance WHERE lot_id = ${lotIdNum}`;

    let result;
    if (existing) {
      [result] = await sql`
        UPDATE lot_performance SET
          lot_number = ${lot.lot_number},
          producer = ${lot.producer},
          public_scale_weight_kg = ${publicScaleKg},
          total_kg_produced = ${totalKgProduced},
          kg_by_caliber = ${JSON.stringify(calibersKg)},
          total_kg_process = ${processKg},
          total_kg_waste = ${wasteKg},
          performance_percentage = ${performancePercentage},
          process_percentage = ${processPercentage},
          waste_percentage = ${wastePercentage},
          last_updated = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
        RETURNING *
      `;
    } else {
      [result] = await sql`
        INSERT INTO lot_performance (
          lot_id, lot_number, producer, fruit_type, entry_date,
          public_scale_weight_kg, total_kg_produced, kg_by_caliber,
          total_kg_process, total_kg_waste,
          performance_percentage, process_percentage, waste_percentage
        ) VALUES (
          ${lotIdNum}, ${lot.lot_number}, ${lot.producer}, ${lot.fruit_type}, ${lot.date},
          ${publicScaleKg}, ${totalKgProduced}, ${JSON.stringify(calibersKg)},
          ${processKg}, ${wasteKg},
          ${performancePercentage}, ${processPercentage}, ${wastePercentage}
        ) RETURNING *
      `;
    }

    // Log central movement for yield recalc
    await logMovement({
      entity_type: 'lot', entity_id: lotIdNum, lot_id: lotIdNum,
      movement_type: 'RECALC_RENDIMIENTO', qty_before: publicScaleKg, qty: kgAfterSelection, qty_after: kgAfterSelection,
      unit: 'kg', module: 'rendimiento', reference: 'post-selection', notes: `Costo real post-seleccion: ${realCostAfterSelection}`
    });

    return { ...result, kg_after_selection: kgAfterSelection, costo_real_post_seleccion: realCostAfterSelection, costo_compra_por_kg: purchaseCostPerKg, diferencia_costo: parseFloat((realCostAfterSelection - purchaseCostPerKg).toFixed(4)) };
  } catch (e) {
    console.error("recalculateLotPerformance error", e);
    return null;
  }
}

export async function syncLotAggregatesFromProduction(lotId, totals) {
  const lotIdNum = parseInt(lotId);
  if (!lotIdNum) return;
  const { total_kg_packed = 0, total_kg_process_delta = 0, total_kg_waste_delta = 0, total_kg_inventory = 0 } = totals || {};
  try {
    await sql`
      UPDATE lots 
      SET 
        total_kg_packed = COALESCE(${total_kg_packed}, total_kg_packed),
        total_kg_process = COALESCE(total_kg_process, 0) + ${total_kg_process_delta},
        total_kg_waste = COALESCE(total_kg_waste, 0) + ${total_kg_waste_delta},
        total_kg_inventory = COALESCE(${total_kg_inventory}, total_kg_inventory),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${lotIdNum}
    `;
  } catch (e) {}
}

/**
 * Safe convenience updater for lot totals from production side.
 * Always safe tagged template.
 */

