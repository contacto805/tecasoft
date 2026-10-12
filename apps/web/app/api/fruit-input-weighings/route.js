// @ts-nocheck
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get('lotId');

  if (lotId) {
    // Authoritative net weight for the lot: ONLY from confirmed reception in fruit_input_weighings.
    // This is the single source of truth for Ingreso de Fruta. Production MUST NOT recapture or alter this value.
    // Sum all rows for the lot (current model has one primary confirmed weighing per lot; future status filter for anulados/reemplazados can be added without JOIN duplication).
    // No other tables (weighings, cutting_orders, etc) override this for canonical received_kg.
    const [result] = await sql`
      SELECT 
        COALESCE(SUM(total_kg_weighed), 0) as total_kg_weighed,
        MAX(public_scale_date) as public_scale_date,
        MAX(notes) as notes,
        MAX(master_batch_id) as master_batch_id,
        COUNT(*) as weighing_count
      FROM fruit_input_weighings 
      WHERE lot_id = ${parseInt(lotId)}
    `;
    return NextResponse.json(result || null);
  }

  return NextResponse.json(null);
}

export async function POST(request) {
  try {
    const { lot_id, total_kg_weighed, public_scale_date, notes, master_batch_id } = await request.json();

    if (!lot_id || !total_kg_weighed) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: lot_id, total_kg_weighed' },
        { status: 400 }
      );
    }
    // Reception confirmed here only. Production and other areas consume via getCanonicalReceivedKg / this endpoint.

    // Get or create master batch for this lot
    let batchId = master_batch_id;
    if (!batchId) {
      // Get active master batch for this lot
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${lot_id} 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      } else {
        // Create new master batch
        const batchNumber = `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
        const newBatch = await sql`
          INSERT INTO master_batches (batch_number, lot_id, status, total_kg_received)
          VALUES (${batchNumber}, ${lot_id}, 'received', ${parseFloat(total_kg_weighed)})
          RETURNING id
        `;
        batchId = newBatch[0].id;
      }
    }

    // Check if record already exists for this lot
    const existing = await sql`
      SELECT id FROM fruit_input_weighings 
      WHERE lot_id = ${lot_id}
    `;

    if (existing.length > 0) {
      // Update existing record
      const result = await sql`
        UPDATE fruit_input_weighings
        SET 
          total_kg_weighed = ${parseFloat(total_kg_weighed)},
          public_scale_date = ${public_scale_date},
          notes = ${notes || null},
          master_batch_id = ${batchId},
          updated_at = CURRENT_TIMESTAMP
        WHERE lot_id = ${lot_id}
        RETURNING *
      `;
      return NextResponse.json(result[0]);
    } else {
      // Create new record
      const result = await sql`
        INSERT INTO fruit_input_weighings (lot_id, total_kg_weighed, public_scale_date, notes, master_batch_id)
        VALUES (${lot_id}, ${parseFloat(total_kg_weighed)}, ${public_scale_date}, ${notes || null}, ${batchId})
        RETURNING *
      `;
      return NextResponse.json(result[0]);
    }
  } catch (error) {
    console.error('Error in POST /api/fruit-input-weighings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { lot_id, total_kg_weighed, public_scale_date, notes, master_batch_id } = await request.json();

    // Get or create master batch for this lot
    let batchId = master_batch_id;
    if (!batchId) {
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${lot_id} 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      }
    }

    const result = await sql`
      UPDATE fruit_input_weighings
      SET 
        total_kg_weighed = ${parseFloat(total_kg_weighed)},
        public_scale_date = ${public_scale_date},
        notes = ${notes || null},
        master_batch_id = ${batchId || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE lot_id = ${lot_id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error in PUT /api/fruit-input-weighings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
