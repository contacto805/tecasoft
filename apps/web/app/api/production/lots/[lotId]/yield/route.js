import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// X. API ÚNICA DE RENDIMIENTO Y TRAZABILIDAD (read-only)
// GET /api/production/lots/{lotId}/yield
// Agrupa SOLO corridas CONFIRMADAS (vigentes).
// Retorna cabecera origen Ingreso, detalle por calibre/calidad/presentación,
// proceso/desecho/merma, kg pendiente, pesos, porcentajes, status, versiones,
// fecha último cambio y vínculos a inventario/embarques.
// NUNCA escribe, inserta movimientos, activa ventas ni side-effects.
// Recálculos persistentes solo en eventos de confirm/corrección (idempotentes).
export async function GET(request, { params }) {
  try {
    const { lotId } = await params;
    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }
    const lotIdNum = parseInt(lotId);

    // Cabecera origen (Ingreso)
    const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotIdNum}`;
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const [ingreso] = await sql`
      SELECT * FROM fruit_input_weighings 
      WHERE lot_id = ${lotIdNum} 
      ORDER BY created_at DESC LIMIT 1
    `;
    const kgRecibido = parseFloat(
      ingreso?.total_kg_weighed || lot.total_kg_received || lot.total_kg || 0
    );

    // Full read-only yield (corridas CONFIRMADAS only). Queries match working /api/production pattern (no status literal in SQL WHERE).
    const allBatchesForLot = await sql`
      SELECT * FROM production_batches 
      WHERE lot_id = ${lotIdNum}
      ORDER BY created_at DESC
    `;
    const batches = allBatchesForLot.filter(b => (b.status || 'CONFIRMADO') === 'CONFIRMADO');
    const confirmedBatchIds = batches.map(b => b.id);

    let details = [];
    if (confirmedBatchIds.length > 0) {
      details = await sql`
        SELECT * FROM production_selection_details 
        WHERE lot_id = ${lotIdNum} 
          AND production_batch_id = ANY(${confirmedBatchIds})
        ORDER BY production_batch_id, id
      `;
    }

    // Pesos presentación (Config, read-only)
    let p10 = 10, p6 = 6;
    try {
      const [r10] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=10 OR nombre ILIKE '%10%') AND COALESCE(activo,true) LIMIT 1`;
      const [r6] = await sql`SELECT kilograms FROM packaging_presentations WHERE (kilograms=6 OR nombre ILIKE '%6%') AND COALESCE(activo,true) LIMIT 1`;
      p10 = r10 ? parseFloat(r10.kilograms) : 10;
      p6 = r6 ? parseFloat(r6.kilograms) : 6;
    } catch (_) {}

    const computeCommercial = (b10, b6, gr = 0) => ((Number(b10)||0)*p10) + ((Number(b6)||0)*p6) + (Number(gr)||0);

    const corridas = batches.map(batch => {
      const bd = details.filter(d => d.production_batch_id === batch.id);
      const rows = bd.map(d => {
        const kg_i = computeCommercial(d.boxes_10kg, d.boxes_6kg, d.additional_granel_kg);
        const pct = kgRecibido > 0 ? parseFloat((kg_i / kgRecibido * 100).toFixed(2)) : 0;
        return { ...d, kg_comercial: Math.round(kg_i*1000)/1000, pct_sobre_ingreso: pct };
      });
      const kgCom = rows.reduce((s,r)=>s+(r.kg_comercial||0),0);
      return {
        batch_id: batch.id,
        version: batch.version || 1,
        status: batch.status,
        fecha: batch.production_date,
        confirmed_at: batch.confirmed_at,
        responsable: batch.responsable,
        turno: batch.turno,
        process_kg: parseFloat(batch.process_kg||0),
        desecho_kg: parseFloat(batch.desecho_kg||0),
        merma_kg: parseFloat(batch.merma_kg||0),
        merma_causa: batch.merma_causa,
        detalles: rows,
        kg_comercial_corrida: Math.round(kgCom*1000)/1000,
        ultimo_cambio: batch.updated_at || batch.created_at
      };
    });

    const totalCom = corridas.reduce((s,c)=>s + c.kg_comercial_corrida,0);
    const totalProc = corridas.reduce((s,c)=>s + c.process_kg,0);
    const totalDes = corridas.reduce((s,c)=>s + c.desecho_kg,0);
    const totalMer = corridas.reduce((s,c)=>s + c.merma_kg,0);
    const dist = totalCom + totalProc + totalDes + totalMer;
    const pend = Math.max(0, kgRecibido - dist);

    const consolidado = {
      kg_netos_recibidos: kgRecibido,
      kg_comercial: Math.round(totalCom*1000)/1000,
      kg_proceso: Math.round(totalProc*1000)/1000,
      kg_desecho: Math.round(totalDes*1000)/1000,
      kg_merma: Math.round(totalMer*1000)/1000,
      kg_distribuidos: Math.round(dist*1000)/1000,
      kg_pendiente: Math.round(pend*1000)/1000,
      pct_rendimiento_comercial: kgRecibido>0 ? parseFloat((totalCom/kgRecibido*100).toFixed(2)) : 0,
      num_corridas_confirmadas: corridas.length
    };

    // Vínculos (read only)
    let inv = [];
    if (confirmedBatchIds.length > 0) {
      inv = await sql`SELECT id, folio_tarima, production_batch_id, total_kg, estado FROM pallet_output_summary WHERE lot_id=${lotIdNum} AND production_batch_id=ANY(${confirmedBatchIds}) LIMIT 50`;
    }
    const emb = await sql`SELECT id, load_date, customer_name, total_kg FROM load_history LIMIT 5`;
    const movs = await sql`SELECT id, movement_type, qty, reference FROM movements WHERE (reference ILIKE '%production%' OR entity_type='production_batch') LIMIT 5`;

    const origen = {
      lot: { id: lot.id, lot_number: lot.lot_number, producer: lot.producer, orchard_name: lot.orchard_name },
      ingreso: ingreso ? { total_kg_weighed: parseFloat(ingreso.total_kg_weighed || 0), public_scale_date: ingreso.public_scale_date } : null,
      kg_recibido_origen: kgRecibido
    };

    return NextResponse.json({
      origen,
      corridas_confirmadas: corridas,
      consolidado,
      vinculos: { inventario: inv, embarques: emb, movimientos: movs },
      fecha_consulta: new Date().toISOString(),
      nota: "Solo corridas CONFIRMADAS. GET read-only. Reutiliza tablas existentes después de migración. Sin writes ni side-effects."
    });
  } catch (error) {
    console.error("Error in GET /api/production/lots/[lotId]/yield:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
