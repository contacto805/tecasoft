import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { logMovement } from "@/app/api/utils/recalculate";
import { recalculateLotPerformance } from "@/app/api/utils/recalculate";

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
        pct_sobre_ingreso: parseFloat(pctIng.toFixed(2))
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
      formula_note: '% sobre ingreso + %proceso + %desecho + %merma + %pendiente = 100% (peso>0)'
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

    const proc = Number(process_kg) || 0;
    const des = Number(waste_kg) || 0;
    const merm = Number(merma_kg) || 0;
    const totalOutput = totalPacked + proc + des + merm;

    if (totalKgReceived > 0 && totalOutput > totalKgReceived + 0.5) {
      return NextResponse.json(
        { error: `Total (${totalOutput.toFixed(2)}) excede recibidos canónicos (${totalKgReceived.toFixed(2)})` },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true, batch: batchRow });
  } catch (error) {
    console.error("Error in POST /api/production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
