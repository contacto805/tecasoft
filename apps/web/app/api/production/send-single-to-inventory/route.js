import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      production_batch_id,
      thermal_label_id,
      lot_number,
      caliber,
      class_name,
      pallets_complete,
      boxes_96,
      boxes_156,
      total_kg,
      packing_date,
      cold_date,
      lot_id
    } = body;

    if (!production_batch_id || !lot_id) {
      return NextResponse.json(
        { error: "production_batch_id y lot_id son requeridos (fuente única de producción confirmada)" },
        { status: 400 }
      );
    }

    const batchId = parseInt(production_batch_id);
    const lotIdNum = parseInt(lot_id);

    // Validate real production batch exists and is confirmed (or allow draft with note)
    const [batch] = await sql`
      SELECT id, status, lot_id FROM production_batches 
      WHERE id = ${batchId} LIMIT 1
    `;
    if (!batch) {
      return NextResponse.json({ error: "Production batch no encontrado" }, { status: 404 });
    }

    // Idempotency: if a tarima already exists for this exact source (batch + thermal or same kg/caliber on same day), return existing
    const [existing] = await sql`
      SELECT * FROM pallet_output_summary 
      WHERE production_batch_id = ${batchId} 
        AND lot_id = ${lotIdNum}
        AND COALESCE(total_kg,0) = ${parseFloat(total_kg) || 0}
        AND COALESCE(caliber,'') = ${caliber || ''}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (existing) {
      return NextResponse.json({ 
        success: true, 
        deduped: true, 
        message: "Tarima ya existía (idempotencia)", 
        data: existing 
      });
    }

    const folio = 'TAR-' + String(thermal_label_id || Date.now()).padStart(6, '0');

    const [outputRecord] = await sql`
      INSERT INTO pallet_output_summary (
        production_batch_id,
        thermal_label_id,
        lot_id,
        pallet_type,
        caliber,
        class_name,
        pallet_count,
        total_kg,
        packing_date,
        cold_date,
        estado,
        folio_tarima,
        version_registro,
        source_system,
        source_id
      ) VALUES (
        ${batchId},
        ${thermal_label_id ? parseInt(thermal_label_id) : null},
        ${lotIdNum},
        'Tarima',
        ${caliber || 'N/A'},
        ${class_name || 'A'},
        1,
        ${parseFloat(total_kg) || 0},
        ${packing_date || new Date().toISOString().split('T')[0]},
        ${cold_date || null},
        'PENDIENTE_UBICACION',
        ${folio},
        1,
        'production',
        ${batchId}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `Tarima enviada al inventario (producción batch ${batchId})`,
      data: outputRecord
    });

  } catch (error) {
    console.error('Error enviando tarima al inventario:', error);
    return NextResponse.json(
      { error: error.message || 'Error enviando tarima al inventario' },
      { status: 500 }
    );
  }
}
