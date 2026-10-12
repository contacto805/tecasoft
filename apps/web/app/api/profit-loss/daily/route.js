import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API de Pérdidas y Ganancias Diario
 * Calcula ingresos, egresos y utilidad diaria
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day'; // 'day', 'week', 'month'

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos' },
        { status: 400 }
      );
    }

    // Obtener resumen de movimientos agrupados por fecha
    const dailySummary = await sql`
      SELECT 
        movement_date,
        SUM(CASE WHEN movement_type = 'INGRESO' THEN amount ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN movement_type = 'EGRESO' THEN amount ELSE 0 END) as total_egresos,
        SUM(CASE WHEN movement_type = 'INGRESO' THEN amount ELSE -amount END) as utilidad_neta
      FROM daily_movements
      WHERE movement_date >= ${startDate} AND movement_date <= ${endDate}
      GROUP BY movement_date
      ORDER BY movement_date ASC
    `;

    // Obtener desglose por categoría
    const categoryBreakdown = await sql`
      SELECT 
        category,
        movement_type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM daily_movements
      WHERE movement_date >= ${startDate} AND movement_date <= ${endDate}
      GROUP BY category, movement_type
      ORDER BY total_amount DESC
    `;

    // Obtener totales generales
    const totals = await sql`
      SELECT 
        SUM(CASE WHEN movement_type = 'INGRESO' THEN amount ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN movement_type = 'EGRESO' THEN amount ELSE 0 END) as total_egresos,
        SUM(CASE WHEN movement_type = 'INGRESO' THEN amount ELSE -amount END) as utilidad_neta,
        COUNT(*) as total_movimientos
      FROM daily_movements
      WHERE movement_date >= ${startDate} AND movement_date <= ${endDate}
    `;

    // Obtener movimientos más recientes
    const recentMovements = await sql`
      SELECT 
        id,
        movement_date,
        movement_type,
        category,
        description,
        amount,
        lot_id,
        created_at
      FROM daily_movements
      WHERE movement_date >= ${startDate} AND movement_date <= ${endDate}
      ORDER BY movement_date DESC, created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({
      period: {
        startDate,
        endDate
      },
      summary: dailySummary,
      categoryBreakdown,
      totals: totals[0] || {},
      recentMovements
    });
  } catch (error) {
    console.error('Error calculating daily profit/loss:', error);
    return NextResponse.json(
      { error: 'Error al calcular pérdidas y ganancias: ' + error.message },
      { status: 500 }
    );
  }
}
