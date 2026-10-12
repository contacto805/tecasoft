import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekNumber = searchParams.get('weekNumber');
    const weekYear = searchParams.get('weekYear');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if ((!weekNumber || !weekYear) && (!startDate || !endDate)) {
      return NextResponse.json({ error: 'Se requiere weekNumber/weekYear o startDate/endDate' }, { status: 400 });
    }

    let where = sql`WHERE status = 'aprobado'`;

    if (weekNumber && weekYear) {
      where = sql`${where} AND week_number = ${weekNumber} AND week_year = ${weekYear}`;
    } else if (startDate && endDate) {
      where = sql`${where} AND cost_date >= ${startDate} AND cost_date <= ${endDate}`;
    }

    // Get costs by type
    const costsByType = await sql`
      SELECT 
        cost_type,
        COUNT(*) as count,
        SUM(amount_mxn) as total_amount
      FROM operating_costs
      ${where}
      GROUP BY cost_type
    `;

    // Calculate totals
    const totalDirectCosts = costsByType.find(c => c.cost_type === 'directo_lote')?.total_amount || 0;
    const totalProductionCosts = costsByType.find(c => c.cost_type === 'empacado')?.total_amount || 0;
    const totalIndirectCosts = costsByType.find(c => c.cost_type === 'indirecto')?.total_amount || 0;
    const totalSalesCosts = costsByType.find(c => c.cost_type === 'venta_carga')?.total_amount || 0;

    const totalWeeklyCosts = parseFloat(totalDirectCosts) + 
                             parseFloat(totalProductionCosts) + 
                             parseFloat(totalIndirectCosts) + 
                             parseFloat(totalSalesCosts);

    // Get kg worked in the week
    const [kgData] = await sql`
      SELECT 
        SUM(total_kg_received) as total_kg_received,
        SUM(total_kg_packed) as total_kg_packed
      FROM lots
      WHERE date >= ${startDate || '2025-01-01'} 
        AND date <= ${endDate || '2025-12-31'}
    `;

    const totalKgWorked = parseFloat(kgData?.total_kg_packed || 0);
    const averageCostPerKg = totalKgWorked > 0 ? totalWeeklyCosts / totalKgWorked : 0;

    // Get sales revenue for the week
    const [salesData] = await sql`
      SELECT SUM(total_amount) as total_revenue
      FROM load_history
      WHERE load_date >= ${startDate || '2025-01-01'}
        AND load_date <= ${endDate || '2025-12-31'}
    `;

    const totalSalesRevenue = parseFloat(salesData?.total_revenue || 0);
    const weeklyProfitLoss = totalSalesRevenue - totalWeeklyCosts;

    return NextResponse.json({
      week_start_date: startDate,
      week_end_date: endDate,
      week_number: weekNumber,
      week_year: weekYear,
      total_direct_costs: totalDirectCosts,
      total_production_costs: totalProductionCosts,
      total_indirect_costs: totalIndirectCosts,
      total_sales_costs: totalSalesCosts,
      total_weekly_costs: totalWeeklyCosts,
      total_kg_worked: totalKgWorked,
      average_cost_per_kg: averageCostPerKg,
      total_sales_revenue: totalSalesRevenue,
      weekly_profit_loss: weeklyProfitLoss,
      costs_by_type: costsByType
    });
  } catch (error) {
    console.error('Error fetching weekly cost summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
