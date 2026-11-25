import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { mexicoToday, validDate } from "@/utils/closing-period";
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

    // VIII: return each corrida (batch) separately + consolidated confirmed only
    // Group details by batch for history view (each corrida independent)
    const detailsByBatch = {};
    details.forEach(d => {
      const bid = d.production_batch_id;
      if (!detailsByBatch[bid]) detailsByBatch[bid] = [];
      detailsByBatch[bid].push(d);
    });

    return NextResponse.json({
      batches, // all corridas (BORRADOR + CONFIRMADO), history shows each + consolidated
      details: computedRows,
      details_by_batch: detailsByBatch,
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
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({ error: 'Inicia sesión para guardar la corrida.' }, { status: 401 });
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
      turno = 'MAÑANA',
      idempotency_key = null
    } = body;

    if (!lot_id) {
      return NextResponse.json({ error: "lot_id required" }, { status: 400 });
    }

    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

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
    // Support short codes 'A'/'B' used in UI and legacy stored data
    validQualitySet.add('A');
    validQualitySet.add('B');
    validQualitySet.add('C');

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

    const proc = Number(process_kg);
    const des = Number(waste_kg);
    const merm = Number(merma_kg);
    if (!Number.isFinite(proc) || proc < 0 || !Number.isFinite(des) || des < 0 || !Number.isFinite(merm) || merm < 0) {
      return NextResponse.json({ error: 'Proceso, Desecho y Merma deben ser no negativos y finitos' }, { status: 400 });
    }


    const prodDate = production_date || mexicoToday();
    if (!validDate(prodDate)) return NextResponse.json({error:"Fecha de producción inválida."},{status:400});
    const lines = caliber_data.map(item=>({
      caliber:String(item.caliber||"").trim(), class_name:String(item.class_name||"A").trim(),
      boxes_10kg:Number(item.boxes_10kg), boxes_6kg:Number(item.boxes_6kg),
      additional_granel_kg:Number(item.additional_granel_kg||0)
    }));
    if (lines.some(line=>!line.caliber && (line.boxes_10kg || line.boxes_6kg || line.additional_granel_kg))) {
      return NextResponse.json({error:"Indica el calibre de cada partida con fruta."},{status:400});
    }
    const [row] = await sql`SELECT erp_save_production(${lot_id},${prodDate},${String(status).toUpperCase()},
      ${proc},${des},${merm},${merma_causa},${user.id},${responsable||user.name},${turno},
      ${notes||""},${idempotency_key},${JSON.stringify(lines)}::jsonb) AS result`;
    const {recalculateLot}=await import("@/app/api/utils/recalculate");
    await recalculateLot(lot_id).catch(error=>console.error("Resumen de lote",error.message));
    return NextResponse.json({success:true,...row.result,corrida_id:row.result.batch.id});
  } catch (error) {
    if (["P0002","23514"].includes(error.code)) return NextResponse.json({error:error.message},{status:error.code==="P0002"?404:422});
    console.error("Error al guardar corrida",error);
    return NextResponse.json({error:"No se pudo guardar la corrida."},{status:500});
  }
}
