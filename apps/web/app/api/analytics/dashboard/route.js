import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Default to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Get all metrics
    const [
      totalLotsData,
      profitabilityData,
      producerPerformanceData,
      orchardPerformanceData,
      calibersData,
      dailyTrendData,
      weeklyData
    ] = await Promise.all([
      // Total lots and operations metrics
      sql`
        SELECT 
          COUNT(*) as total_lots,
          SUM(total_kg_cut) as total_kg_cut,
          SUM(total_kg_received) as total_kg_received,
          SUM(total_kg_packed) as total_kg_packed,
          SUM(total_kg_process) as total_kg_process,
          SUM(total_kg_waste) as total_kg_waste,
          SUM(total_kg_sold) as total_kg_sold,
          SUM(total_revenue) as total_revenue,
          SUM(total_cost) as total_cost,
          SUM(net_profit) as total_profit
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr}
      `,

      // Profitability metrics
      sql`
        SELECT 
          AVG(CAST(net_profit as NUMERIC) / NULLIF(CAST(total_revenue as NUMERIC), 0) * 100) as avg_margin,
          MIN(CAST(net_profit as NUMERIC) / NULLIF(CAST(total_revenue as NUMERIC), 0) * 100) as min_margin,
          MAX(CAST(net_profit as NUMERIC) / NULLIF(CAST(total_revenue as NUMERIC), 0) * 100) as max_margin,
          COUNT(CASE WHEN net_profit > 0 THEN 1 END) as profitable_lots,
          COUNT(CASE WHEN net_profit <= 0 THEN 1 END) as unprofitable_lots
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr} AND total_revenue > 0
      `,

      // Producer performance
      sql`
        SELECT 
          producer,
          COUNT(*) as lots_count,
          SUM(total_kg_received) as total_kg,
          SUM(total_revenue) as total_revenue,
          SUM(net_profit) as total_profit,
          AVG(CAST(net_profit as NUMERIC) / NULLIF(CAST(total_revenue as NUMERIC), 0) * 100) as avg_margin
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr}
        GROUP BY producer
        ORDER BY total_profit DESC
        LIMIT 10
      `,

      // Orchard performance
      sql`
        SELECT 
          orchard_name,
          COUNT(*) as lots_count,
          SUM(total_kg_cut) as total_kg_cut,
          SUM(total_kg_received) as total_kg_received,
          SUM(total_revenue) as total_revenue,
          SUM(net_profit) as total_profit
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr}
        GROUP BY orchard_name
        ORDER BY total_profit DESC
        LIMIT 10
      `,

      // Caliber performance
      sql`
        SELECT 
          caliber,
          SUM(total_kg) as total_kg,
          COUNT(*) as caliber_count
        FROM lot_inventory
        WHERE creation_date >= ${startStr} AND creation_date <= ${endStr}
        GROUP BY caliber
        ORDER BY total_kg DESC
      `,

      // Daily trend
      sql`
        SELECT 
          date,
          COUNT(*) as lots,
          SUM(total_revenue) as revenue,
          SUM(net_profit) as profit
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr}
        GROUP BY date
        ORDER BY date ASC
      `,

      // Weekly summary
      sql`
        SELECT 
          DATE_TRUNC('week', date::date)::date as week_start,
          COUNT(*) as lots,
          SUM(total_kg_received) as total_kg,
          SUM(total_revenue) as revenue,
          SUM(net_profit) as profit
        FROM lots
        WHERE date >= ${startStr} AND date <= ${endStr}
        GROUP BY DATE_TRUNC('week', date::date)
        ORDER BY week_start ASC
      `
    ]);

    return NextResponse.json({
      period: {
        start_date: startStr,
        end_date: endStr
      },
      summary: totalLotsData.length > 0 ? {
        total_lots: totalLotsData[0].total_lots || 0,
        total_kg_cut: parseFloat(totalLotsData[0].total_kg_cut) || 0,
        total_kg_received: parseFloat(totalLotsData[0].total_kg_received) || 0,
        total_kg_packed: parseFloat(totalLotsData[0].total_kg_packed) || 0,
        total_kg_process: parseFloat(totalLotsData[0].total_kg_process) || 0,
        total_kg_waste: parseFloat(totalLotsData[0].total_kg_waste) || 0,
        total_kg_sold: parseFloat(totalLotsData[0].total_kg_sold) || 0,
        total_revenue: parseFloat(totalLotsData[0].total_revenue) || 0,
        total_cost: parseFloat(totalLotsData[0].total_cost) || 0,
        total_profit: parseFloat(totalLotsData[0].total_profit) || 0,
        efficiency: totalLotsData[0].total_kg_received > 0 
          ? (((parseFloat(totalLotsData[0].total_kg_sold) || 0) / parseFloat(totalLotsData[0].total_kg_received)) * 100).toFixed(2)
          : 0
      } : {},
      profitability: profitabilityData.length > 0 ? {
        avg_margin: parseFloat(profitabilityData[0].avg_margin || 0).toFixed(2),
        min_margin: parseFloat(profitabilityData[0].min_margin || 0).toFixed(2),
        max_margin: parseFloat(profitabilityData[0].max_margin || 0).toFixed(2),
        profitable_lots: profitabilityData[0].profitable_lots || 0,
        unprofitable_lots: profitabilityData[0].unprofitable_lots || 0
      } : {},
      top_producers: producerPerformanceData.map(p => ({
        name: p.producer,
        lots_count: p.lots_count,
        total_kg: parseFloat(p.total_kg) || 0,
        total_revenue: parseFloat(p.total_revenue) || 0,
        total_profit: parseFloat(p.total_profit) || 0,
        avg_margin: parseFloat(p.avg_margin || 0).toFixed(2)
      })),
      top_orchards: orchardPerformanceData.map(o => ({
        name: o.orchard_name,
        lots_count: o.lots_count,
        total_kg_cut: parseFloat(o.total_kg_cut) || 0,
        total_kg_received: parseFloat(o.total_kg_received) || 0,
        total_revenue: parseFloat(o.total_revenue) || 0,
        total_profit: parseFloat(o.total_profit) || 0
      })),
      caliber_distribution: calibersData.map(c => ({
        caliber: c.caliber,
        total_kg: parseFloat(c.total_kg) || 0,
        count: c.caliber_count
      })),
      daily_trend: dailyTrendData.map(d => ({
        date: d.date,
        lots: d.lots,
        revenue: parseFloat(d.revenue) || 0,
        profit: parseFloat(d.profit) || 0
      })),
      weekly_summary: weeklyData.map(w => ({
        week_start: w.week_start,
        lots: w.lots,
        total_kg: parseFloat(w.total_kg) || 0,
        revenue: parseFloat(w.revenue) || 0,
        profit: parseFloat(w.profit) || 0
      }))
    });
  } catch (error) {
    console.error("Error in GET /api/analytics/dashboard:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
