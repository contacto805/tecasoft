import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { production_batch_id, final_notes } = await request.json();

    if (!production_batch_id) {
      return NextResponse.json(
        { error: 'production_batch_id is required' },
        { status: 400 }
      );
    }

    // Get the batch info
    const [batch] = await sql`
      SELECT * FROM production_batches
      WHERE id = ${parseInt(production_batch_id)}
    `;

    if (!batch) {
      return NextResponse.json(
        { error: 'Production batch not found' },
        { status: 404 }
      );
    }

    // Update batch status to completed
    const [updated] = await sql`
      UPDATE production_batches
      SET 
        status = 'Completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(production_batch_id)}
      RETURNING *
    `;

    // Get all thermal labels for the report
    const labels = await sql`
      SELECT * FROM thermal_labels
      WHERE production_batch_id = ${parseInt(production_batch_id)}
    `;

    // Calculate totals
    const totals = {
      total_pallets: labels.reduce((sum, l) => sum + (l.pallets_complete || 0), 0),
      total_boxes_96: labels.reduce((sum, l) => sum + (l.boxes_96 || 0), 0),
      total_boxes_156: labels.reduce((sum, l) => sum + (l.boxes_156 || 0), 0),
      total_labels: labels.length
    };

    return NextResponse.json({
      success: true,
      message: 'Lote completado exitosamente',
      batch: updated,
      totals
    });
  } catch (error) {
    console.error('Error completing batch:', error);
    return NextResponse.json(
      { error: 'Error completing batch: ' + error.message },
      { status: 500 }
    );
  }
}
