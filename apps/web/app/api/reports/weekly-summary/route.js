import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { week_start_date, week_end_date } = await request.json();

    // Get week number and year
    const startDate = new Date(week_start_date);
    const weekNumber = getWeekNumber(startDate);
    const weekYear = startDate.getFullYear();

    // Gather metrics from all modules
    const metrics = await gatherWeeklyMetrics(week_start_date, week_end_date);

    const result = await sql`
      INSERT INTO weekly_summary_reports (
        week_start_date,
        week_end_date,
        week_number,
        week_year,
        auto_generated,
        metrics_summary,
        status
      )
      VALUES (
        ${week_start_date},
        ${week_end_date},
        ${weekNumber},
        ${weekYear},
        TRUE,
        ${JSON.stringify(metrics)},
        'completed'
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error generating weekly summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const reports = await sql`
      SELECT * FROM weekly_summary_reports 
      ORDER BY week_start_date DESC 
      LIMIT ${limit}
    `;

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching weekly summaries:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to get week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Gather metrics from all modules for the week
async function gatherWeeklyMetrics(startDate, endDate) {
  const metrics = {};

  try {
    // Lots created this week
    const lots = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total_kg_received), 0) as total_kg
      FROM lots 
      WHERE date >= ${startDate} AND date <= ${endDate}
    `;
    metrics.lots = { 
      count: parseInt(lots[0]?.count || 0), 
      total_kg: parseFloat(lots[0]?.total_kg || 0) 
    };

    // Cutting orders this week
    const orders = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(net_weight), 0) as total_kg
      FROM cutting_orders 
      WHERE cutting_date >= ${startDate} AND cutting_date <= ${endDate}
    `;
    metrics.cutting_orders = { 
      count: parseInt(orders[0]?.count || 0), 
      total_kg: parseFloat(orders[0]?.total_kg || 0) 
    };

    // Box control this week
    const boxes = await sql`
      SELECT 
        COALESCE(SUM(boxes_out), 0) as boxes_out,
        COALESCE(SUM(boxes_returned), 0) as boxes_returned,
        COALESCE(SUM(missing_boxes), 0) as missing
      FROM box_control 
      WHERE date_out >= ${startDate} AND date_out <= ${endDate}
    `;
    metrics.box_control = {
      boxes_out: parseInt(boxes[0]?.boxes_out || 0),
      boxes_returned: parseInt(boxes[0]?.boxes_returned || 0),
      missing: parseInt(boxes[0]?.missing || 0)
    };

    // Loads/shipments this week
    const loads = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total_kg), 0) as total_kg, COALESCE(SUM(total_amount), 0) as revenue
      FROM load_history 
      WHERE load_date >= ${startDate} AND load_date <= ${endDate}
    `;
    metrics.loads = {
      count: parseInt(loads[0]?.count || 0),
      total_kg: parseFloat(loads[0]?.total_kg || 0),
      revenue: parseFloat(loads[0]?.revenue || 0)
    };

    // Sales of process and waste this week
    const sales = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue
      FROM sales_of_process_and_waste 
      WHERE date >= ${startDate} AND date <= ${endDate}
    `;
    metrics.sales_process_waste = {
      count: parseInt(sales[0]?.count || 0),
      revenue: parseFloat(sales[0]?.revenue || 0)
    };

    // Operating costs this week
    const costs = await sql`
      SELECT COALESCE(SUM(amount_mxn), 0) as total
      FROM operating_costs 
      WHERE cost_date >= ${startDate} AND cost_date <= ${endDate}
    `;
    metrics.operating_costs = {
      total: parseFloat(costs[0]?.total || 0)
    };

    // Purchase orders this week
    const purchases = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM purchase_orders 
      WHERE order_date >= ${startDate} AND order_date <= ${endDate}
    `;
    metrics.purchase_orders = {
      count: parseInt(purchases[0]?.count || 0),
      total: parseFloat(purchases[0]?.total || 0)
    };

    // Pending payments
    const payments = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payment_schedule 
      WHERE status = 'pending' AND scheduled_payment_date <= ${endDate}
    `;
    metrics.pending_payments = {
      count: parseInt(payments[0]?.count || 0),
      total: parseFloat(payments[0]?.total || 0)
    };

  } catch (error) {
    console.error('Error gathering metrics:', error);
  }

  return metrics;
}
