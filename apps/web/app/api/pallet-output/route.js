import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const outputs = await sql`
        SELECT pos.*, 
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer
        FROM pallet_output_summary pos
        LEFT JOIN lots l ON pos.lot_id = l.id
        WHERE pos.master_batch_id = ${parseInt(batchId)}
        ORDER BY pos.created_at DESC
      `;
      return NextResponse.json(outputs);
    }

    if (lotId) {
      const outputs = await sql`
        SELECT pos.*, 
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer
        FROM pallet_output_summary pos
        LEFT JOIN lots l ON pos.lot_id = l.id
        WHERE pos.lot_id = ${parseInt(lotId)}
        ORDER BY pos.created_at DESC
      `;
      return NextResponse.json(outputs);
    }

    const outputs = await sql`
      SELECT pos.*, 
        COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
        COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
        l.lot_number, l.producer
      FROM pallet_output_summary pos
      LEFT JOIN lots l ON pos.lot_id = l.id
      ORDER BY pos.created_at DESC
    `;

    return NextResponse.json(outputs);
  } catch (error) {
    console.error("Error fetching pallet outputs:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      production_batch_id,
      lot_id,
      pallet_type,
      caliber,
      class_name,
      pallet_count,
      total_kg,
      packing_date,
      cold_date,
      master_batch_id,
      user_id,
      user_name
    } = await request.json();

    if (!lot_id || !total_kg) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let batchId = master_batch_id;

    // Find active batch if not provided
    if (!batchId && lot_id) {
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${lot_id} 
        AND status IN ('received', 'processing')
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      }
    }

    const result = await sql`
      INSERT INTO pallet_output_summary (
        production_batch_id,
        lot_id,
        pallet_type,
        caliber,
        class_name,
        pallet_count,
        total_kg,
        packing_date,
        cold_date,
        master_batch_id
      )
      VALUES (
        ${production_batch_id || null},
        ${parseInt(lot_id)},
        ${pallet_type || null},
        ${caliber || null},
        ${class_name || null},
        ${pallet_count || 0},
        ${parseFloat(total_kg)},
        ${packing_date || null},
        ${cold_date || null},
        ${batchId || null}
      )
      RETURNING *
    `;

    // Update master batch inventory
    if (batchId) {
      const totalInventory = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM pallet_output_summary
        WHERE master_batch_id = ${batchId}
      `;

      const totalShipped = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM load_history
        WHERE master_batch_id = ${batchId}
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
        WHERE id = ${batchId}
      `;

      // Also deduct materials from inventory
      await deductMaterialsForProduction(production_batch_id, pallet_count, total_kg);

      // Log traceability event
      await sql`
        INSERT INTO traceability_log (
          master_batch_id,
          lot_id,
          event_type,
          event_category,
          event_description,
          related_entity_type,
          related_entity_id,
          user_id,
          user_name,
          metadata
        )
        VALUES (
          ${batchId},
          ${parseInt(lot_id)},
          'pallet_output_recorded',
          'production',
          ${`Pallet output recorded - ${pallet_count} pallet(s), ${total_kg} kg`},
          'pallet_output',
          ${result[0].id},
          ${user_id || null},
          ${user_name || null},
          ${JSON.stringify({
            pallet_type,
            caliber,
            class_name,
            pallet_count,
            total_kg,
            packing_date,
            cold_date
          })}
        )
      `;
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating pallet output:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to deduct materials from inventory during production
async function deductMaterialsForProduction(productionBatchId, palletCount, totalKg) {
  try {
    if (!productionBatchId) return;

    // Typical materials usage per pallet (these are examples, adjust based on your needs)
    const materialsPerPallet = {
      'Cajas de Cartón': 40, // 40 boxes per pallet
      'Tarimas': 1, // 1 pallet per pallet output
      'Etiquetas': 40, // 1 label per box
    };

    for (const [materialName, quantityPerPallet] of Object.entries(materialsPerPallet)) {
      const totalQuantity = quantityPerPallet * palletCount;

      // Check if material exists in inventory
      const material = await sql`
        SELECT id, quantity_available 
        FROM materials_inventory 
        WHERE material_name = ${materialName}
        LIMIT 1
      `;

      if (material.length > 0) {
        const materialId = material[0].id;
        const currentQuantity = parseFloat(material[0].quantity_available);

        // Deduct from inventory
        await sql`
          UPDATE materials_inventory
          SET 
            quantity_available = quantity_available - ${totalQuantity},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${materialId}
        `;

        // Record the deduction
        await sql`
          INSERT INTO material_deductions (
            production_batch_id,
            material_id,
            quantity_used
          )
          VALUES (
            ${productionBatchId},
            ${materialId},
            ${totalQuantity}
          )
        `;

        // Check if below minimum stock and create alert
        if (currentQuantity - totalQuantity < material[0].minimum_stock) {
          // You could trigger an alert here
          console.log(`⚠️ Material ${materialName} below minimum stock`);
        }
      }
    }
  } catch (error) {
    console.error("Error deducting materials:", error);
    // Don't throw - allow pallet creation to succeed even if material tracking fails
  }
}
