import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Calculate profit for a lot
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const lotData = lot[0];

    // Calculate REVENUES
    // 1. Main sales (from load_history)
    const mainSales = await sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total
      FROM load_history
      WHERE lot_id = ${lotId}
    `;

    // 2. Process sales
    const processSales = await sql`
      SELECT 
        COALESCE(SUM(total_price), 0) as total
      FROM sales_of_process_and_waste
      WHERE lot_id = ${lotId} AND process_kg > 0
    `;

    // 3. Waste sales
    const wasteSales = await sql`
      SELECT 
        COALESCE(SUM(total_price), 0) as total
      FROM sales_of_process_and_waste
      WHERE lot_id = ${lotId} AND waste_kg > 0
    `;

    // Calculate COSTS
    // 1. Fruit acquisition cost
    const fruitCost = (parseFloat(lotData.total_kg_received) || 0) * (parseFloat(lotData.fruit_price) || 0);

    // 2. Commission cost
    const commissionCost = parseFloat(lotData.commission_amount) || 0;

    // 3. Other expenses (freight, crew, etc.)
    const otherExpenses = await sql`
      SELECT 
        COALESCE(SUM(CASE 
          WHEN expense_type = 'freight' THEN cost_per_unit * quantity
          WHEN expense_type = 'crew' THEN cost_per_unit * quantity
          ELSE 0
        END), 0) as total
      FROM expenses
      WHERE related_id = ${lotId}
    `;

    // Calculate TOTALS
    const mainSalesTotal = parseFloat(mainSales[0]?.total || 0);
    const processSalesTotal = parseFloat(processSales[0]?.total || 0);
    const wasteSalesTotal = parseFloat(wasteSales[0]?.total || 0);
    const totalRevenue = mainSalesTotal + processSalesTotal + wasteSalesTotal;

    const totalCost = fruitCost + commissionCost + (parseFloat(otherExpenses[0]?.total) || 0);

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0;
    const profitPerKg = (parseFloat(lotData.total_kg_received) || 1) > 0 
      ? grossProfit / (parseFloat(lotData.total_kg_received) || 1)
      : 0;

    // Get breakdown of costs and revenues
    const costBreakdown = {
      fruit_acquisition: fruitCost,
      commission: commissionCost,
      other_expenses: parseFloat(otherExpenses[0]?.total) || 0
    };

    const revenueBreakdown = {
      main_sales: mainSalesTotal,
      process_sales: processSalesTotal,
      waste_sales: wasteSalesTotal
    };

    return NextResponse.json({
      lot_id: lotId,
      lot_number: lotData.lot_number,
      total_kg_received: parseFloat(lotData.total_kg_received) || 0,
      total_kg_sold: parseFloat(lotData.total_kg_sold) || 0,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      gross_profit: grossProfit,
      profit_margin_percentage: profitMargin,
      profit_per_kg: profitPerKg,
      cost_breakdown: costBreakdown,
      revenue_breakdown: revenueBreakdown,
      status: lotData.lot_traceability_status || 'pending'
    });
  } catch (error) {
    console.error("Error in GET /api/lot-profit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
