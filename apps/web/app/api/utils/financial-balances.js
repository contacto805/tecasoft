import sql from "@/app/api/utils/sql";

export async function getReceivableBalance() {
  const [row] = await sql`
    SELECT COALESCE(ROUND(SUM(saldo_usd)::numeric, 2), 0) AS total
    FROM notas
    WHERE estatus IN ('Pendiente', 'Parcial', 'Vencida')
  `;
  return Number(row.total);
}

export function outstandingPayments() {
  return sql`
    SELECT scheduled_payment_date, due_date, producer_name, bank_name,
      GREATEST(0, COALESCE(saldo_pendiente, amount - COALESCE(monto_pagado, 0))) AS balance
    FROM payment_schedule
    WHERE COALESCE(status, 'scheduled') IN ('scheduled', 'partial', 'pending', 'pendiente')
  `;
}

export function administrativeDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export async function getPayableBalances() {
  const today = administrativeDate();
  const [row] = await sql`
    SELECT COALESCE(SUM(balance), 0) AS total,
      COUNT(*) FILTER (WHERE due_date BETWEEN ${today}::date AND ${today}::date + 7) AS upcoming_count,
      COALESCE(SUM(balance) FILTER (
        WHERE due_date BETWEEN ${today}::date AND ${today}::date + 7
      ), 0) AS upcoming_total
    FROM (${outstandingPayments()}) AS payments
    WHERE balance > 0
  `;
  return { total: Number(row.total), upcoming_count: Number(row.upcoming_count), upcoming_total: Number(row.upcoming_total) };
}
