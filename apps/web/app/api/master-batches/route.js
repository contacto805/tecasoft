import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Generate unique batch number
function generateBatchNumber() {
  const timestamp = Date.now().toString().slice(-8);
  return `BATCH-${new Date().getFullYear()}-${timestamp}`;
}

// GET - Fetch all master batches or a specific one
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('id');
    const lotId = searchParams.get('lotId');

    if (batchId) {
      // Get detailed batch info with all related data
      const batch = await sql`
        SELECT 
          mb.*,
          l.lot_number,
          l.producer,
          l.fruit_type,
          l.date as lot_date
        FROM master_batches mb
        LEFT JOIN lots l ON mb.lot_id = l.id
        WHERE mb.id = ${parseInt(batchId)}
      `;

      if (!batch.length) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      }

      // Get weighings
      const weighings = await sql`
        SELECT * FROM weighings 
        WHERE master_batch_id = ${parseInt(batchId)}
        ORDER BY timestamp DESC
      `;

      // Get cutting orders
      const cuttingOrders = await sql`
        SELECT * FROM cutting_orders 
        WHERE master_batch_id = ${parseInt(batchId)}
        ORDER BY created_at DESC
      `;

      // Get production batches
      const productionBatches = await sql`
        SELECT * FROM production_batches 
        WHERE master_batch_id = ${parseInt(batchId)}
        ORDER BY created_at DESC
      `;

      // Get inventory (pallet outputs)
      const inventory = await sql`
        SELECT * FROM pallet_output_summary 
        WHERE master_batch_id = ${parseInt(batchId)}
        ORDER BY created_at DESC
      `;

      // Get shipments
      const shipments = await sql`
        SELECT * FROM load_history 
        WHERE master_batch_id = ${parseInt(batchId)}
        ORDER BY created_at DESC
      `;

      return NextResponse.json({
        batch: batch[0],
        weighings,
        cuttingOrders,
        productionBatches,
        inventory,
        shipments
      });
    }

    if (lotId) {
      // Get all batches for a specific lot
      const batches = await sql`
        SELECT * FROM master_batches 
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY created_at DESC
      `;
      return NextResponse.json(batches);
    }

    // Get all batches with summary info
    const batches = await sql`
      SELECT 
        mb.*,
        l.lot_number,
        l.producer,
        l.fruit_type,
        COUNT(DISTINCT w.id) as weighing_count,
        COUNT(DISTINCT co.id) as cutting_order_count,
        COUNT(DISTINCT pb.id) as production_batch_count,
        COUNT(DISTINCT lh.id) as shipment_count
      FROM master_batches mb
      LEFT JOIN lots l ON mb.lot_id = l.id
      LEFT JOIN weighings w ON mb.id = w.master_batch_id
      LEFT JOIN cutting_orders co ON mb.id = co.master_batch_id
      LEFT JOIN production_batches pb ON mb.id = pb.master_batch_id
      LEFT JOIN load_history lh ON mb.id = lh.master_batch_id
      GROUP BY mb.id, l.lot_number, l.producer, l.fruit_type
      ORDER BY mb.created_at DESC
    `;

    return NextResponse.json(batches);
  } catch (error) {
    console.error("Error fetching master batches:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new master batch (usually from intake)
export async function POST(request) {
  try {
    const { lot_id, initial_kg } = await request.json();

    if (!lot_id) {
      return NextResponse.json(
        { error: "lot_id is required" },
        { status: 400 }
      );
    }

    const batchNumber = generateBatchNumber();

    const result = await sql`
      INSERT INTO master_batches (
        batch_number, 
        lot_id, 
        status, 
        total_kg_received,
        total_kg_in_inventory
      )
      VALUES (
        ${batchNumber}, 
        ${parseInt(lot_id)}, 
        'received',
        ${parseFloat(initial_kg) || 0},
        ${parseFloat(initial_kg) || 0}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating master batch:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update master batch status and totals
export async function PUT(request) {
  try {
    const { 
      id, 
      status, 
      total_kg_processed, 
      total_kg_in_inventory,
      total_kg_shipped 
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // Build update query dynamically
    let updates = [];
    let values = [];

    if (status !== undefined) {
      updates.push('status');
      values.push(status);
    }
    if (total_kg_processed !== undefined) {
      updates.push('total_kg_processed');
      values.push(parseFloat(total_kg_processed));
    }
    if (total_kg_in_inventory !== undefined) {
      updates.push('total_kg_in_inventory');
      values.push(parseFloat(total_kg_in_inventory));
    }
    if (total_kg_shipped !== undefined) {
      updates.push('total_kg_shipped');
      values.push(parseFloat(total_kg_shipped));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE master_batches
      SET 
        status = COALESCE(${status || null}, status),
        total_kg_processed = COALESCE(${total_kg_processed !== undefined ? parseFloat(total_kg_processed) : null}, total_kg_processed),
        total_kg_in_inventory = COALESCE(${total_kg_in_inventory !== undefined ? parseFloat(total_kg_in_inventory) : null}, total_kg_in_inventory),
        total_kg_shipped = COALESCE(${total_kg_shipped !== undefined ? parseFloat(total_kg_shipped) : null}, total_kg_shipped),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result.length) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating master batch:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to recalculate batch totals
export async function recalculateBatchTotals(batchId) {
  try {
    // Get total kg received from weighings
    const weighingTotal = await sql`
      SELECT COALESCE(SUM(net_weight), 0) as total
      FROM weighings
      WHERE master_batch_id = ${batchId}
    `;

    // Get total kg processed from production
    const productionTotal = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as total
      FROM pallet_output_summary
      WHERE master_batch_id = ${batchId}
    `;

    // Get total kg shipped
    const shippedTotal = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as total
      FROM load_history
      WHERE master_batch_id = ${batchId}
    `;

    const totalReceived = parseFloat(weighingTotal[0]?.total || 0);
    const totalProcessed = parseFloat(productionTotal[0]?.total || 0);
    const totalShipped = parseFloat(shippedTotal[0]?.total || 0);
    const totalInInventory = totalProcessed - totalShipped;

    // Update batch
    await sql`
      UPDATE master_batches
      SET 
        total_kg_received = ${totalReceived},
        total_kg_processed = ${totalProcessed},
        total_kg_in_inventory = ${totalInInventory},
        total_kg_shipped = ${totalShipped},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${batchId}
    `;

    return {
      totalReceived,
      totalProcessed,
      totalInInventory,
      totalShipped
    };
  } catch (error) {
    console.error("Error recalculating batch totals:", error);
    throw error;
  }
}
