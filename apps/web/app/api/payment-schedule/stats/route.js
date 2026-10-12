import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const today = new Date().toISOString().split('T')[0];

    // Get weekly scheduled payments
    const weekStart = new Date();
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    const weeklyPayments = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment_schedule
      WHERE scheduled_payment_date >= ${weekStartStr}
        AND scheduled_payment_date <= ${weekEndStr}
        AND status = 'scheduled'
    `;

    // Get monthly scheduled payments
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const monthlyPayments = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment_schedule
      WHERE EXTRACT(MONTH FROM scheduled_payment_date) = ${currentMonth}
        AND EXTRACT(YEAR FROM scheduled_payment_date) = ${currentYear}
        AND status = 'scheduled'
    `;

    // Get producers pending payment
    const pendingProducers = await sql`
      SELECT COUNT(DISTINCT producer_name) as count
      FROM payment_schedule
      WHERE status = 'scheduled'
    `;

    // Get fruit about to expire (13 days or less) — safe date range
    const urgentEnd = new Date();
    urgentEnd.setDate(urgentEnd.getDate() + 13);
    const urgentEndStr = urgentEnd.toISOString().split('T')[0];
    const urgentPayments = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payment_schedule
      WHERE due_date >= ${today}
        AND due_date <= ${urgentEndStr}
        AND status = 'scheduled'
    `;

    // Get overdue payments — safe
    const overduePayments = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payment_schedule
      WHERE due_date < ${today}
        AND status = 'scheduled'
    `;

    // Get accumulated liabilities
    const totalLiabilities = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment_schedule
      WHERE status = 'scheduled'
    `;

    // Get calendar data (all Fridays with payments)
    let calendarData = [];
    if (month && year) {
      calendarData = await sql`
        SELECT 
          scheduled_payment_date,
          COUNT(*) as payment_count,
          COALESCE(SUM(amount), 0) as total_amount,
          ARRAY_AGG(DISTINCT producer_name) as producers,
          ARRAY_AGG(DISTINCT bank_name) as banks
        FROM payment_schedule
        WHERE EXTRACT(MONTH FROM scheduled_payment_date) = ${parseInt(month)}
          AND EXTRACT(YEAR FROM scheduled_payment_date) = ${parseInt(year)}
          AND status = 'scheduled'
        GROUP BY scheduled_payment_date
        ORDER BY scheduled_payment_date
      `;
    }

    return NextResponse.json({
      weekly_scheduled: parseFloat(weeklyPayments[0].total || 0),
      monthly_scheduled: parseFloat(monthlyPayments[0].total || 0),
      pending_producers: parseInt(pendingProducers[0].count || 0),
      urgent_count: parseInt(urgentPayments[0].count || 0),
      urgent_amount: parseFloat(urgentPayments[0].total || 0),
      overdue_count: parseInt(overduePayments[0].count || 0),
      overdue_amount: parseFloat(overduePayments[0].total || 0),
      total_liabilities: parseFloat(totalLiabilities[0].total || 0),
      calendar_data: calendarData
    });
  } catch (error) {
    console.error("Error fetching payment stats:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas de pagos" },
      { status: 500 }
    );
  }
}
