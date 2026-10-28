import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { production_batch_id, lot_id, master_batch_id, from_selection } = await request.json();

    if (!production_batch_id || !lot_id) {
      return NextResponse.json(
        { error: 'production_batch_id y lot_id son requeridos (única fuente confirmada de producción)' },
        { status: 400 }
      );
    }

    const batchId = parseInt(production_batch_id);
    const lotIdNum = parseInt(lot_id);

    // Idempotency: if tarimas already exist for this batch, return them (no dups on double click / retry)
    const existing = await sql`
      SELECT * FROM pallet_output_summary 
      WHERE production_batch_id = ${batchId} AND lot_id = ${lotIdNum}
      ORDER BY created_at DESC
    `;
    if (existing.length > 0) {
      return NextResponse.json({ 
        success: true, 
        deduped: true, 
        message: `${existing.length} tarimas ya existían para el batch`, 
        records: existing 
      });
    }

    // Prefer production_selection_details for this batch as the real source of what was packed (not only thermal labels)
    const details = await sql`
      SELECT * FROM production_selection_details 
      WHERE production_batch_id = ${batchId} AND lot_id = ${lotIdNum}
    `;

    const insertedRecords = [];

    if (details.length > 0) {
      // Create one physical tarima record per selection detail row (supports partial/mixed)
      for (const d of details) {
        const kg = parseFloat(d.total_kg || 0);
        if (kg <= 0) continue;
        const folio = `TAR-${new Date().getFullYear()}-${String(Date.now() + insertedRecords.length).slice(-8)}`;
        const [row] = await sql`
          INSERT INTO pallet_output_summary (
            production_batch_id, lot_id, master_batch_id,
            pallet_type, caliber, class_name, pallet_count, total_kg,
            packing_date, cold_date, estado, folio_tarima, version_registro, source_system, source_id
          ) VALUES (
            ${batchId}, ${lotIdNum}, ${master_batch_id || null},
            'Tarima', ${d.caliber || null}, ${d.class_name || 'A'}, 1, ${kg},
            CURRENT_DATE, NULL, 'PENDIENTE_UBICACION', ${folio}, 1, 'production', ${batchId}
          ) RETURNING *
        `;
        insertedRecords.push(row);
      }
    } else {
      // Fallback: use thermal labels if no selection details yet (legacy path)
      const labels = await sql`
        SELECT * FROM thermal_labels WHERE production_batch_id = ${batchId}
      `;
      for (const label of labels) {
        const boxes = (label.boxes_96 || 0) + (label.boxes_156 || 0);
        const kg = parseFloat(label.total_kg || 0) || (boxes * 10);
        const [row] = await sql`
          INSERT INTO pallet_output_summary (
            production_batch_id, lot_id, master_batch_id, thermal_label_id,
            pallet_type, caliber, class_name, pallet_count, total_kg,
            packing_date, cold_date, estado, folio_tarima, version_registro
          ) VALUES (
            ${batchId}, ${lotIdNum}, ${master_batch_id || null}, ${label.id || null},
            'Tarima', ${label.caliber}, ${label.class_name}, 1, ${kg},
            ${label.packing_date || new Date().toISOString().slice(0,10)}, ${label.cold_date || null},
            'PENDIENTE_UBICACION', ${'TAR-' + String(label.id || Date.now()).padStart(6,'0')}, 1
          ) RETURNING *
        `;
        insertedRecords.push(row);
      }
    }

    // Rebuild lot aggregates from single confirmed sources (no double counting)
    const { recalculateLot } = await import('@/app/api/utils/recalculate');
    await recalculateLot(lotIdNum);

    // Update master_batch totals only if provided (optional)
    if (master_batch_id) {
      const totalInventory = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM pallet_output_summary
        WHERE master_batch_id = ${parseInt(master_batch_id)}
          AND COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA')
      `;
      const totalShipped = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM load_history WHERE master_batch_id = ${parseInt(master_batch_id)}
      `;
      const processed = parseFloat(totalInventory[0]?.total || 0);
      const shipped = parseFloat(totalShipped[0]?.total || 0);
      await sql`
        UPDATE master_batches
        SET total_kg_processed = ${processed},
            total_kg_in_inventory = ${Math.max(0, processed - shipped)},
            status = 'processing',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(master_batch_id)}
      `;
    }

    return NextResponse.json({
      success: true,
      message: `${insertedRecords.length} tarimas creadas (única fuente production_batch)`,
      records: insertedRecords
    });
  } catch (error) {
    console.error('Error sending to inventory:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
