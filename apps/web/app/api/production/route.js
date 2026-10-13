import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { logMovement } from "@/app/api/utils/recalculate";
import { recalculateLotPerformance } from "@/app/api/utils/recalculate";

// VI: Helper - load authorized purchase prices from published (precios_fruta_publicados latest active)
// NEVER use client-sent prices for financial valuation.
async function loadAuthorizedPurchasePrices() {
  try {
    const rows = await sql`
      SELECT * FROM precios_fruta_publicados 
      WHERE COALESCE(activo, true) = true 
      ORDER BY fecha_publicacion DESC, id DESC 
      LIMIT 1
    `;
    const p = rows[0] || {};
    // Map common calibers to buy price (purchase price authorized)
    return {
      SUPER: parseFloat(p.super_extra || 0),
      EXTRA: parseFloat(p.extra || 0),
      PRIMERA: parseFloat(p.primera || 0),
      MEDIANO: parseFloat(p.mediano || 0),
      TERCERA: parseFloat(p.tercera || 0),
      CUARTA: parseFloat(p.cuarta || 0),
      PROCESO: parseFloat(p.proceso || 0),
      CANICA: parseFloat(p.canica || 0),
      DESECHO: parseFloat(p.desecho || 0),
      default: 0
    };
  } catch (_) {
    return { default: 0 };
  }
}

function getAuthorizedPriceForCaliber(prices, caliber) {
  const key = String(caliber || '').toUpperCase().trim();
  if (prices[key] != null) return prices[key];
  // fuzzy map
  if (key.includes('SUPER') || key.includes('EXTRA')) return prices.EXTRA || prices.default || 0;
  if (key.includes('PRIM')) return prices.PRIMERA || prices.default || 0;
  if (key.includes('MED')) return prices.MEDIANO || prices.default || 0;
  if (key.includes('TERC')) return prices.TERCERA || prices.default || 0;
  if (key.includes('CUART')) return prices.CUARTA || prices.default || 0;
  if (key.includes('PROC')) return prices.PROCESO || prices.default || 0;
  if (key.includes('CAN') || key.includes('IND')) return prices.CANICA || prices.default || 0;
  return prices.default || 0;
}

// GET - Fetch production batches for a lot + consolidated formulas (backend only)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    const lotIdNum = parseInt(lotId);

    // Get production batch info (confirmed = non BORRADOR)
    const batches = await sql`
      SELECT * FROM production_batches 
      WHERE lot_id = ${lotIdNum}
      ORDER BY created_at DESC
    `;

    // confirmed batches only for formulas
    const confirmedBatchIds = batches
      .filter(b => (b.status || 'CONFIRMADO') !== 'BORRADOR')
      .map(b => b.id);

    let details = [];
    if (confirmedBatchIds.length > 0) {
      details = await sql`
        SELECT psd.* FROM production_selection_details psd
        WHERE psd.lot_id = ${lotIdNum} 
          AND psd.production_batch_id = ANY(${confirmedBatchIds})
        ORDER BY psd.id
      `;
    } else {
      // fallback all for draft view
      details = await sql`
        SELECT * FROM production_selection_details 
        WHERE lot_id = ${lotIdNum}
        ORDER BY created_at DESC
      `;
    }

    // SINGLE SOURCE received
    const { getCanonicalReceivedKg } = await import('@/app/api/utils/recalculate');
    const received = await getCanonicalReceivedKg(lotIdNum);

    // Compute presentation weights (from Config)
    let p10 = 10, p6 = 6;
    try {
      const [r10] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=10 OR nombre ILIKE '%10%') AND COALESCE(activo,true) LIMIT 1`;
      const [r6] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=6 OR nombre ILIKE '%6%') AND COALESCE(activo,true) LIMIT 1`;
      p10 = r10 ? parseFloat(r10.kilograms) : 10;
      p6 = r6 ? parseFloat(r6.kilograms) : 6;
    } catch(_) {}

    const computeRowCommercial = (b10, b6, gr) => {
      const v = ((Number(b10)||0) * p10) + ((Number(b6)||0) * p6) + (Number(gr)||0);
      return Math.round(v * 1000) / 1000;
    };

    // Per row + sums only from confirmed
    let kgComercial = 0;
    const computedRows = details.map(d => {
      const kg_i = computeRowCommercial(d.boxes_10kg, d.boxes_6kg, d.additional_granel_kg);
      kgComercial += kg_i;
      const pctIng = received > 0 ? (kg_i / received * 100) : 0;
      return {
        ...d,
        kg_comercial_i: kg_i,
        pct_sobre_ingreso: parseFloat(pctIng.toFixed(2)),
        caliber: d.caliber,
        total_kg: d.total_kg || 0
      };
    });

    // confirmed process / desecho / merma (sum only confirmed)
    let kgProceso = 0, kgDesecho = 0, kgMerma = 0;
    batches.filter(b => (b.status || 'CONFIRMADO') !== 'BORRADOR').forEach(b => {
      kgProceso += Number(b.process_kg || 0);
      kgDesecho += Number(b.desecho_kg || 0);
      kgMerma += Number(b.merma_kg || 0);
    });

    const kgDistribuidos = kgComercial + kgProceso + kgDesecho + kgMerma;
    const kgPendientes = Math.max(0, received - kgDistribuidos);

    const pctRendCom = received > 0 ? (kgComercial / received * 100) : 0;
    const pctProc = received > 0 ? (kgProceso / received * 100) : 0;
    const pctDes = received > 0 ? (kgDesecho / received * 100) : 0;
    const pctMerm = received > 0 ? (kgMerma / received * 100) : 0;
    const pctPend = received > 0 ? (kgPendientes / received * 100) : 0;
    const balance = pctRendCom + pctProc + pctDes + pctMerm + pctPend;

    // VI: VALOR REAL PONDERADO POR LOTE - usando precios AUTORIZADOS del backend (precios_fruta_publicados)
    // Producción NO captura ni cambia precio. Precios vienen de versión autorizada con vigencia.
    // Nunca se acepta price enviado desde navegador para cálculo financiero.
    const authorizedPrices = await loadAuthorizedPurchasePrices();
    let valorClasificado = 0;
    computedRows.forEach(r => {
      const kg = parseFloat(r.kg_comercial_i || r.total_kg || 0) || 0;
      const authPrice = getAuthorizedPriceForCaliber(authorizedPrices, r.caliber);
      valorClasificado += kg * authPrice;
    });
    // Proceso / Desecho: si representan compra (según acuerdo), sumar su valor autorizado. Merma NO genera compra adicional.
    const procPrice = authorizedPrices.PROCESO || authorizedPrices.default || 0;
    const desPrice = authorizedPrices.DESECHO || authorizedPrices.default || 0;
    valorClasificado += (kgProceso * procPrice) + (kgDesecho * desPrice);

    const hasMandatoryPrices = Object.values(authorizedPrices).some(v => Number(v) > 0);
    const precioPonderado = (received > 0 && hasMandatoryPrices) 
      ? (valorClasificado / received) 
      : null;

    const yieldSummary = received > 0 ? {
      kg_netos_recibidos: received,
      kg_comercial: Math.round(kgComercial * 1000) / 1000,
      kg_proceso: Math.round(kgProceso * 1000) / 1000,
      kg_desecho: Math.round(kgDesecho * 1000) / 1000,
      kg_merma_confirmada: Math.round(kgMerma * 1000) / 1000,
      kg_distribuidos: Math.round(kgDistribuidos * 1000) / 1000,
      kg_pendientes: Math.round(kgPendientes * 1000) / 1000,
      pct_rendimiento_comercial: parseFloat(pctRendCom.toFixed(2)),
      pct_proceso: parseFloat(pctProc.toFixed(2)),
      pct_desecho: parseFloat(pctDes.toFixed(2)),
      pct_merma: parseFloat(pctMerm.toFixed(2)),
      pct_pendiente: parseFloat(pctPend.toFixed(2)),
      balance_total: parseFloat(balance.toFixed(2)),
      formula_note: '% sobre ingreso + %proceso + %desecho + %merma + %pendiente = 100% (peso>0)',
      // Block 08: explicit balance flag + tolerance reference (no silent close)
      balance_ok: Math.abs(balance - 100) <= 0.5 || received === 0,
      tolerance_note: 'Diferencias > tolerancia física configurada deben registrarse explícitamente (merma o autorización)',
      // VI: Valor real ponderado (precios autorizados backend, sin precio manual en producción)
      valor_clasificado: Math.round(valorClasificado * 1000) / 1000,
      precio_ponderado_sobre_ingreso: precioPonderado != null ? parseFloat(precioPonderado.toFixed(4)) : null,
      precio_ponderado_label: precioPonderado != null ? 'Precio ponderado sobre ingreso' : 'Pendiente de valoración',
      valor_proceso_desecho_incluido: Math.round(((kgProceso * (authorizedPrices.PROCESO||0)) + (kgDesecho * (authorizedPrices.DESECHO||0))) * 1000) / 1000,
      merma_no_genera_compra_adicional: true,
      nota_separacion: 'Mantener separados: (1) precio pactado productor, (2) valor clasificación precios autorizados, (3) obligación contrato, (4) valor comercial destino, (5) costo integral (cuadrillas/fletes/empaque desde sus módulos).',
      // VII: Proceso/Desecho son inventario trazable, NO venta automática aquí.
      proceso_desecho_es_inventario: true,
      venta_comercial_solo_en_modulo_ventas_proceso_desecho: true
    } : {
      message: 'Sin ingreso confirmado / No calculable',
      kg_netos_recibidos: 0
    };

    return NextResponse.json({
      batches,
      details: computedRows,
      yield_summary: yieldSummary
    });
  } catch (error) {
    console.error("Error in GET /api/production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create production batch (updated for unique physical formulas, granel, independent proceso/desecho/merma)
// Block 08: strict physical validations, configurable tolerance, explicit differences, no silent adjustments, pallet capacities configurable only
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      production_date,
      caliber_data = [], // now supports [{caliber, class_name, boxes_10kg, boxes_6kg, additional_granel_kg, ...}]
      material_deductions,
      notes,
      process_kg = 0,
      waste_kg = 0,
      merma_kg = 0,
      merma_causa = '',
      status = 'BORRADOR',
      responsable = '',
      turno = 'MAÑANA'
    } = body;

    if (!lot_id) {
      return NextResponse.json({ error: "lot_id required" }, { status: 400 });
    }

    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const { getCanonicalReceivedKg } = await import('@/app/api/utils/recalculate');
    const totalKgReceived = await getCanonicalReceivedKg(lot_id);

    // === BLOCK 08: LOAD CONFIGURABLE TOLERANCE (system_settings or default 5kg) ===
    let toleranceKg = 5;
    try {
      const [tolRow] = await sql`SELECT value FROM system_settings WHERE key = 'SELECTION_PHYSICAL_TOLERANCE_KG' LIMIT 1`;
      if (tolRow && tolRow.value) toleranceKg = parseFloat(tolRow.value) || 5;
    } catch(_) {}

    // === BLOCK 08: STRICT INPUT VALIDATIONS (cajas enteras >=0, kg>=0, finitos, catálogos existentes) ===
    const validCalibersRes = await sql`SELECT caliber_code, caliber_name, display_name FROM caliber_definitions WHERE COALESCE(is_active, true) = true`;
    const validCaliberSet = new Set();
    validCalibersRes.forEach(c => {
      if (c.caliber_code) validCaliberSet.add(String(c.caliber_code).toUpperCase());
      if (c.caliber_name) validCaliberSet.add(String(c.caliber_name).toUpperCase());
      if (c.display_name) validCaliberSet.add(String(c.display_name).toUpperCase());
    });

    const validQualitiesRes = await sql`SELECT quality_name, display_name FROM quality_options WHERE COALESCE(is_active, true) = true`;
    const validQualitySet = new Set();
    validQualitiesRes.forEach(q => {
      if (q.quality_name) validQualitySet.add(String(q.quality_name).toUpperCase());
      if (q.display_name) validQualitySet.add(String(q.display_name).toUpperCase());
    });

    for (const item of caliber_data) {
      const b10 = parseInt(item.boxes_10kg);
      const b6 = parseInt(item.boxes_6kg);
      const gr = parseFloat(item.additional_granel_kg || 0);
      const pKg = parseFloat(item.process_kg || 0);
      const wKg = parseFloat(item.waste_kg || 0);

      if (!Number.isFinite(b10) || b10 < 0 || b10 !== parseFloat(item.boxes_10kg)) {
        return NextResponse.json({ error: 'Cajas 10kg deben ser enteras no negativas' }, { status: 400 });
      }
      if (!Number.isFinite(b6) || b6 < 0 || b6 !== parseFloat(item.boxes_6kg)) {
        return NextResponse.json({ error: 'Cajas 6kg deben ser enteras no negativas' }, { status: 400 });
      }
      if (!Number.isFinite(gr) || gr < 0) {
        return NextResponse.json({ error: 'Kg adicionales a granel deben ser no negativos' }, { status: 400 });
      }
      if (!Number.isFinite(pKg) || pKg < 0 || !Number.isFinite(wKg) || wKg < 0) {
        return NextResponse.json({ error: 'Cantidades de proceso/desecho deben ser finitas no negativas' }, { status: 400 });
      }

      const calU = String(item.caliber || '').toUpperCase().trim();
      if (calU && validCaliberSet.size > 0 && !validCaliberSet.has(calU)) {
        return NextResponse.json({ error: `Calibre '${item.caliber}' no existe en catálogos activos de Configuración` }, { status: 400 });
      }
      const clsU = String(item.class_name || 'A').toUpperCase().trim();
      if (clsU && validQualitySet.size > 0 && !validQualitySet.has(clsU)) {
        return NextResponse.json({ error: `Calidad '${item.class_name}' no existe en catálogos activos de Configuración` }, { status: 400 });
      }
    }

    const proc = Number(process_kg) || 0;
    const des = Number(waste_kg) || 0;
    const merm = Number(merma_kg) || 0;
    if (!Number.isFinite(proc) || proc < 0 || !Number.isFinite(des) || des < 0 || !Number.isFinite(merm) || merm < 0) {
      return NextResponse.json({ error: 'Proceso, Desecho y Merma deben ser no negativos y finitos' }, { status: 400 });
    }

    // Compute using backend formulas for each row (dynamic weights)
    const p10 = 10; // will override with catalog below
    const p6 = 6;
    // fetch real
    let realP10 = 10, realP6 = 6;
    try {
      const [pp10] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=10 OR nombre ILIKE '%10%') AND COALESCE(activo,true) LIMIT 1`;
      const [pp6] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=6 OR nombre ILIKE '%6%') AND COALESCE(activo,true) LIMIT 1`;
      realP10 = pp10 ? parseFloat(pp10.kilograms) : 10;
      realP6 = pp6 ? parseFloat(pp6.kilograms) : 6;
    } catch(_) {}

    const computeKg = (b10, b6, gr) => {
      const kg = (Number(b10)||0) * realP10 + (Number(b6)||0) * realP6 + (Number(gr)||0);
      return Math.round(kg * 1000) / 1000;
    };

    let totalPacked = 0;
    let totalProcessFromRows = 0;
    let totalWasteFromRows = 0;

    for (const item of caliber_data) {
      const rowKg = computeKg(item.boxes_10kg, item.boxes_6kg, item.additional_granel_kg);
      totalPacked += rowKg;
      totalProcessFromRows += Number(item.process_kg || 0);
      totalWasteFromRows += Number(item.waste_kg || 0);
    }

    const totalOutput = totalPacked + proc + des + merm;

    // === BLOCK 08: NO EXCEDER PESO GLOBAL + TOLERANCIA CONFIGURABLE (bloquea explícitamente, sin ajuste silencioso) ===
    if (totalKgReceived > 0) {
      const over = totalOutput - totalKgReceived;
      if (over > toleranceKg) {
        return NextResponse.json(
          { 
            error: `KG_DISTRIBUIDOS (${totalOutput.toFixed(3)}) excede recibidos (${totalKgReceived.toFixed(3)}) por encima de tolerancia física configurada (${toleranceKg} kg). Diferencia: ${over.toFixed(3)} kg. Registre merma/causa o ajuste autorizado explícitamente.`,
            diff: parseFloat(over.toFixed(3)),
            tolerance: toleranceKg,
            received: totalKgReceived,
            distributed: totalOutput
          },
          { status: 400 }
        );
      }
    }

    // === BLOCK 08: NO PERMITIR FINALIZAR CON KILOS SIN EXPLICAR (para CONFIRMADO) ===
    const kgDistribuidosCheck = totalPacked + proc + des + merm;
    const kgPendientesCheck = Math.max(0, totalKgReceived - kgDistribuidosCheck);
    if ((status || '').toUpperCase() === 'CONFIRMADO' && totalKgReceived > 0) {
      if (kgPendientesCheck > toleranceKg && (!merma_causa || String(merma_causa).trim() === '')) {
        return NextResponse.json(
          { error: `Lote no puede confirmarse con ${kgPendientesCheck.toFixed(2)} kg pendientes sin causa de merma/diferencia autorizada registrada. Una corrida parcial requiere explicación explícita para cerrar.` },
          { status: 400 }
        );
      }
    }

    // Create or update batch with meta + formulas fields
    const [existingBatch] = await sql`
      SELECT id FROM production_batches WHERE lot_id = ${lot_id} ORDER BY created_at DESC LIMIT 1
    `;
    let batchRow;
    const prodDate = production_date || new Date().toISOString().split('T')[0];
    if (existingBatch && (status === 'BORRADOR' || status === 'VALIDADO')) {
      [batchRow] = await sql`
        UPDATE production_batches SET
          production_date = ${prodDate},
          status = ${status},
          process_kg = ${proc},
          desecho_kg = ${des},
          merma_kg = ${merm},
          merma_causa = ${merma_causa},
          responsable = ${responsable},
          turno = ${turno},
          observaciones = ${notes || ''},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingBatch.id}
        RETURNING *
      `;
    } else {
      [batchRow] = await sql`
        INSERT INTO production_batches (
          lot_id, production_date, status, process_kg, desecho_kg, merma_kg, merma_causa, responsable, turno, observaciones
        )
        VALUES (${lot_id}, ${prodDate}, ${status}, ${proc}, ${des}, ${merm}, ${merma_causa}, ${responsable}, ${turno}, ${notes || ''})
        RETURNING *
      `;
    }

    const batchId = batchRow ? batchRow.id : (existingBatch ? existingBatch.id : null);

    // Remove draft rows for this batch to avoid dups on re-save (only for draft)
    if (status === 'BORRADOR' && batchId) {
      await sql`DELETE FROM production_selection_details WHERE production_batch_id = ${batchId}`;
    }

    // Insert / re-insert rows with precise formula
    for (const item of caliber_data) {
      const gr = Number(item.additional_granel_kg || 0);
      const rowTotalKg = computeKg(item.boxes_10kg, item.boxes_6kg, gr);

      // prevent duplicate combo in same corrida (backend enforcement)
      const [dup] = await sql`
        SELECT 1 FROM production_selection_details 
        WHERE production_batch_id = ${batchId} AND lot_id = ${lot_id} 
          AND caliber = ${item.caliber} AND class_name = ${item.class_name || 'A'}
          AND COALESCE(boxes_10kg,0) = ${parseInt(item.boxes_10kg)||0}
          AND COALESCE(boxes_6kg,0) = ${parseInt(item.boxes_6kg)||0}
          AND COALESCE(additional_granel_kg,0) = ${gr}
        LIMIT 1
      `;
      if (dup) continue; // skip dup combo

      await sql`
        INSERT INTO production_selection_details (
          production_batch_id, lot_id, caliber, class_name,
          boxes_10kg, boxes_6kg, additional_granel_kg, total_kg
        ) VALUES (
          ${batchId}, ${lot_id}, ${item.caliber}, ${item.class_name || 'A'},
          ${parseInt(item.boxes_10kg)||0}, ${parseInt(item.boxes_6kg)||0}, ${gr}, ${rowTotalKg}
        )
      `;
    }

    // Rebuild canonical aggregates
    const { recalculateLot } = await import('@/app/api/utils/recalculate');
    await recalculateLot(lot_id);

    return NextResponse.json({ success: true, batch: batchRow, tolerance_applied: toleranceKg });
  } catch (error) {
    console.error("Error in POST /api/production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
