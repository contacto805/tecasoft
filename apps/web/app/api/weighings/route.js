import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    
    let weighings;
    if (lotId) {
      weighings = await sql`
        SELECT * FROM weighings 
        WHERE lot_id = ${lotId}
        ORDER BY timestamp DESC
      `;
    } else {
      weighings = await sql`
        SELECT * FROM weighings 
        ORDER BY timestamp DESC
      `;
    }
    
    return NextResponse.json(weighings);
  } catch (error) {
    console.error('Error in GET /api/weighings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { 
      lot_id,
      boxes,
      gross_weight,
      with_pallet,
      net_weight,
      tare_weight,
      photo_url,
      master_batch_id
    } = await request.json();
    
    let batchId = master_batch_id;
    
    // If no master_batch_id provided, create or find one for this lot
    if (!batchId && lot_id) {
      // Check if there's an existing active batch for this lot
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${lot_id} 
        AND status IN ('received', 'processing')
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      } else {
        // Create new master batch
        const timestamp = Date.now().toString().slice(-8);
        const batchNumber = `BATCH-${new Date().getFullYear()}-${timestamp}`;
        
        const newBatch = await sql`
          INSERT INTO master_batches (
            batch_number, 
            lot_id, 
            status, 
            total_kg_received,
            total_kg_in_inventory
          )
          VALUES (
            ${batchNumber}, 
            ${lot_id}, 
            'received',
            ${parseFloat(net_weight) || 0},
            ${parseFloat(net_weight) || 0}
          )
          RETURNING *
        `;
        batchId = newBatch[0].id;
      }
    }
    
    const result = await sql`
      INSERT INTO weighings (
        lot_id,
        boxes,
        gross_weight,
        with_pallet,
        net_weight,
        tare_weight,
        photo_url,
        master_batch_id,
        timestamp
      )
      VALUES (
        ${lot_id},
        ${boxes},
        ${gross_weight},
        ${with_pallet},
        ${net_weight},
        ${tare_weight},
        ${photo_url},
        ${batchId || null},
        NOW()
      )
      RETURNING *
    `;
    
    // Update master batch totals if batch exists
    if (batchId) {
      const totalWeighings = await sql`
        SELECT COALESCE(SUM(net_weight), 0) as total
        FROM weighings
        WHERE master_batch_id = ${batchId}
      `;
      
      await sql`
        UPDATE master_batches
        SET 
          total_kg_received = ${parseFloat(totalWeighings[0]?.total || 0)},
          total_kg_in_inventory = ${parseFloat(totalWeighings[0]?.total || 0)},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${batchId}
      `;
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error in POST /api/weighings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
