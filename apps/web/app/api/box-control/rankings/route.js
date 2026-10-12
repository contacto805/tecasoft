import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Fetch responsible rankings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const responsibleType = searchParams.get('responsibleType');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    let filters = sql``;
    if (responsibleType) {
      filters = sql`${filters} AND responsible_type = ${responsibleType}`;
    }
    if (periodStart && periodEnd) {
      filters = sql`${filters} AND period_start = ${periodStart} AND period_end = ${periodEnd}`;
    }

    const rankings = await sql`
      SELECT * FROM box_responsible_rankings 
      WHERE 1=1 ${filters}
      ORDER BY performance_score DESC, loss_percentage ASC
    `;

    return NextResponse.json({ success: true, rankings });
  } catch (error) {
    console.error('Error in GET /api/box-control/rankings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Generate rankings for a period
export async function POST(request) {
  try {
    const { periodStart, periodEnd } = await request.json();

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: periodStart, periodEnd' },
        { status: 400 }
      );
    }

    // Get all movements in the period
    const movements = await sql`
      SELECT 
        responsible_type,
        responsible_name,
        SUM(boxes_quantity) as total_boxes,
        COUNT(*) as total_movements,
        SUM(CASE WHEN operational_state = 'Extraviada' THEN boxes_quantity ELSE 0 END) as boxes_lost,
        SUM(CASE WHEN operational_state = 'Dañada' THEN boxes_quantity ELSE 0 END) as boxes_damaged,
        SUM(CASE WHEN operational_state = 'Recuperada' THEN boxes_quantity ELSE 0 END) as boxes_returned_ok,
        SUM(penalty_amount) as total_penalties,
        SUM(CASE WHEN penalty_paid = TRUE THEN penalty_amount ELSE 0 END) as penalties_paid,
        SUM(CASE WHEN penalty_paid = FALSE THEN penalty_amount ELSE 0 END) as penalties_pending
      FROM box_control_movements
      WHERE movement_date BETWEEN ${periodStart} AND ${periodEnd}
        AND responsible_type IS NOT NULL
        AND responsible_name IS NOT NULL
      GROUP BY responsible_type, responsible_name
    `;

    // Calculate rankings for each responsible
    for (const movement of movements) {
      const totalBoxes = parseInt(movement.total_boxes) || 0;
      const boxesLost = parseInt(movement.boxes_lost) || 0;
      const boxesReturned = parseInt(movement.boxes_returned_ok) || 0;

      const lossPercentage = totalBoxes > 0 ? (boxesLost / totalBoxes) * 100 : 0;
      const onTimePercentage = totalBoxes > 0 ? (boxesReturned / totalBoxes) * 100 : 0;
      const performanceScore = Math.max(0, 100 - lossPercentage);

      await sql`
        INSERT INTO box_responsible_rankings (
          responsible_type, responsible_name, period_start, period_end,
          total_movements, total_boxes_handled, boxes_lost, boxes_damaged, 
          boxes_returned_ok, loss_percentage, on_time_return_percentage,
          total_penalties, penalties_paid, penalties_pending, performance_score
        )
        VALUES (
          ${movement.responsible_type}, ${movement.responsible_name},
          ${periodStart}, ${periodEnd}, ${movement.total_movements},
          ${totalBoxes}, ${boxesLost}, ${movement.boxes_damaged || 0},
          ${boxesReturned}, ${lossPercentage.toFixed(2)}, ${onTimePercentage.toFixed(2)},
          ${movement.total_penalties || 0}, ${movement.penalties_paid || 0},
          ${movement.penalties_pending || 0}, ${performanceScore.toFixed(2)}
        )
        ON CONFLICT (responsible_type, responsible_name, period_start, period_end)
        DO UPDATE SET
          total_movements = EXCLUDED.total_movements,
          total_boxes_handled = EXCLUDED.total_boxes_handled,
          boxes_lost = EXCLUDED.boxes_lost,
          boxes_damaged = EXCLUDED.boxes_damaged,
          boxes_returned_ok = EXCLUDED.boxes_returned_ok,
          loss_percentage = EXCLUDED.loss_percentage,
          on_time_return_percentage = EXCLUDED.on_time_return_percentage,
          total_penalties = EXCLUDED.total_penalties,
          penalties_paid = EXCLUDED.penalties_paid,
          penalties_pending = EXCLUDED.penalties_pending,
          performance_score = EXCLUDED.performance_score,
          last_calculated = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    // Get updated rankings
    const rankings = await sql`
      SELECT * FROM box_responsible_rankings 
      WHERE period_start = ${periodStart} AND period_end = ${periodEnd}
      ORDER BY performance_score DESC, loss_percentage ASC
    `;

    return NextResponse.json({ success: true, rankings });
  } catch (error) {
    console.error('Error in POST /api/box-control/rankings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
