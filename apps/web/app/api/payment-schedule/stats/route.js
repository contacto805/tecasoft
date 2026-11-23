import sql from "@/app/api/utils/sql";
import { administrativeDate, outstandingPayments } from "@/app/api/utils/financial-balances";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const today = administrativeDate();
    const month = Number(searchParams.get("month") ?? today.slice(5, 7));
    const year = Number(searchParams.get("year") ?? today.slice(0, 4));

    if (!Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(year) || year < 1 || year > 9999) {
      return NextResponse.json({ error: "Mes o año inválido" }, { status: 400 });
    }

    const monthStart = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    const [[stats], calendar] = await Promise.all([
      sql`
        WITH payments AS (${outstandingPayments()})
        SELECT
          COALESCE(SUM(balance) FILTER (
            WHERE scheduled_payment_date >= date_trunc('week', ${today}::date)
              AND scheduled_payment_date < date_trunc('week', ${today}::date) + INTERVAL '7 days'
          ), 0) AS weekly_scheduled,
          COALESCE(SUM(balance) FILTER (
            WHERE scheduled_payment_date >= ${monthStart}::date
              AND scheduled_payment_date < ${monthStart}::date + INTERVAL '1 month'
          ), 0) AS monthly_scheduled,
          COUNT(DISTINCT producer_name) AS pending_producers,
          COUNT(*) FILTER (WHERE due_date BETWEEN ${today}::date AND ${today}::date + 13) AS urgent_count,
          COALESCE(SUM(balance) FILTER (WHERE due_date BETWEEN ${today}::date AND ${today}::date + 13), 0) AS urgent_amount,
          COUNT(*) FILTER (WHERE due_date < ${today}::date) AS overdue_count,
          COALESCE(SUM(balance) FILTER (WHERE due_date < ${today}::date), 0) AS overdue_amount,
          COALESCE(SUM(balance), 0) AS total_liabilities
        FROM payments
        WHERE balance > 0
      `,
      sql`
        SELECT scheduled_payment_date::text AS scheduled_payment_date, COUNT(*) AS payment_count, SUM(balance) AS total_amount,
          ARRAY_AGG(DISTINCT producer_name) FILTER (WHERE producer_name IS NOT NULL) AS producers,
          ARRAY_AGG(DISTINCT bank_name) FILTER (WHERE bank_name IS NOT NULL) AS banks
        FROM (${outstandingPayments()}) AS payments
        WHERE balance > 0 AND scheduled_payment_date >= ${monthStart}::date
          AND scheduled_payment_date < ${monthStart}::date + INTERVAL '1 month'
        GROUP BY scheduled_payment_date ORDER BY scheduled_payment_date
      `
    ]);

    return NextResponse.json({
      ...Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, Number(value)])),
      calendar_data: calendar.map(row => ({
        ...row,
        payment_count: Number(row.payment_count),
        total_amount: Number(row.total_amount),
        producers: row.producers ?? [],
        banks: row.banks ?? []
      }))
    });
  } catch (error) {
    console.error("Error fetching payment stats:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas de pagos" }, { status: 500 });
  }
}
