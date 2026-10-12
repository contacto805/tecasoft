import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { production_batch_id, lot_id, master_batch_id } = await request.json();

    if (!production_batch_id || !lot_id) {
      return NextResponse.json(
        { error: 'production_batch_id y lot_id son requeridos' },
        { status: 400 }
      );
    }

    // Get all thermal labels for this production batch
    const labels = await sql`
      SELECT * FROM thermal_labels
      WHERE production_batch_id = ${parseInt(production_batch_id)}
    `;

    if (!labels || labels.length === 0) {
      return NextResponse.json(
        { error: 'No hay etiquetas térmicas para este lote de producción' },
        { status: 404 }
      );
    }

    // ONE ROW = ONE PHYSICAL TARIMA (pallet_count always 1 for new records).
    // No more aggregation by caliber. Each label/thermal entry becomes its own physical tarima row.
    const insertedRecords = [];

    for (const label of labels) {
      const boxes = (label.boxes_96 || 0) + (label.boxes_156 || 0);
      const kg = parseFloat(label.total_kg || 0) || (boxes * 10); // safe fallback

      const [row] = await sql`
        INSERT INTO pallet_output_summary (
          production_batch_id,
          lot_id,
          master_batch_id,
          thermal_label_id,
          pallet_type,
          caliber,
          class_name,
          pallet_count,
          total_kg,
          packing_date,
          cold_date,
          estado,
          folio_tarima,
          version_registro
        )
        VALUES (
          ${parseInt(production_batch_id)},
          ${parseInt(lot_id)},
          ${master_batch_id ? parseInt(master_batch_id) : null},
          ${label.id || null},
          'Tarima',
          ${label.caliber},
          ${label.class_name},
          1,
          ${kg},
          ${label.packing_date},
          ${label.cold_date || null},
          'PENDIENTE_UBICACION',
          ${'TAR-' + String(label.id || Date.now()).padStart(6, '0')},
          1
        )
        RETURNING *
      `;
      insertedRecords.push(row);
    }

    // Update master_batch totals if available
    if (master_batch_id) {
      const totalInventory = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM pallet_output_summary
        WHERE master_batch_id = ${parseInt(master_batch_id)}
      `;

      const totalShipped = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM load_history
        WHERE master_batch_id = ${parseInt(master_batch_id)}
      `;

      const processed = parseFloat(totalInventory[0]?.total || 0);
      const shipped = parseFloat(totalShipped[0]?.total || 0);

      await sql`
        UPDATE master_batches
        SET 
          total_kg_processed = ${processed},
          total_kg_in_inventory = ${processed - shipped},
          status = 'processing',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(master_batch_id)}
      `;
    }

    return NextResponse.json({
      success: true,
      message: `${insertedRecords.length} registros enviados al inventario`,
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
