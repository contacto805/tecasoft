import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { isSuperAdmin, sanitizeForNonSuper } from "@/app/api/utils/super-admin";

export async function GET() {
  try {
    const isSuper = await isSuperAdmin();
    const rows = await sql`SELECT * FROM load_history ORDER BY load_date DESC LIMIT 300`;
    const safe = (rows || []).map(r => sanitizeForNonSuper(r, isSuper));
    return NextResponse.json(safe);
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { userId, userName } = data;
    
    let batchId = data.masterBatchId;
    
    // If no master_batch_id provided, try to find from lot_id or available inventory
    if (!batchId && data.lotId) {
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${data.lotId} 
        AND status IN ('processing', 'ready')
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      }
    }
    
    const result = await sql`
      INSERT INTO load_history (
        load_date, customer_name, destination, caliber, 
        presentation_kg, pallets_count, boxes_count, total_kg, 
        unit_price, total_amount, currency, notes, master_batch_id, customer_id
      ) VALUES (
        ${data.loadDate}, ${data.customerName}, ${data.destination}, ${data.caliber},
        ${data.presentationKg}, ${data.palletsCount}, ${data.boxesCount}, ${data.totalKg},
        ${data.unitPrice}, ${data.totalAmount}, ${data.currency}, ${data.notes || null},
        ${batchId || null}, ${data.customerId || null}
      )
      RETURNING *
    `;
    
    // Update master batch inventory after shipment
    if (batchId) {
      const totalShipped = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM load_history
        WHERE master_batch_id = ${batchId}
      `;

      const totalProcessed = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM pallet_output_summary
        WHERE master_batch_id = ${batchId}
      `;

      const processed = parseFloat(totalProcessed[0]?.total || 0);
      const shipped = parseFloat(totalShipped[0]?.total || 0);
      const inInventory = processed - shipped;

      await sql`
        UPDATE master_batches
        SET 
          total_kg_shipped = ${shipped},
          total_kg_in_inventory = ${inInventory},
          status = ${inInventory <= 0 ? 'completed' : 'processing'},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${batchId}
      `;

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
          ${data.lotId || null},
          'shipment_dispatched',
          'shipment',
          ${`Shipment to ${data.customerName} - ${data.totalKg} kg, ${data.palletsCount} pallets`},
          'load_history',
          ${result[0].id},
          ${userId || null},
          ${userName || null},
          ${JSON.stringify({
            customer_name: data.customerName,
            destination: data.destination,
            caliber: data.caliber,
            pallets_count: data.palletsCount,
            boxes_count: data.boxesCount,
            total_kg: data.totalKg,
            unit_price: data.unitPrice,
            total_amount: data.totalAmount,
            currency: data.currency
          })}
        )
      `;
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating load history:', error);
    return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await sql`DELETE FROM load_history WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting load history:', error);
    return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 });
  }
}