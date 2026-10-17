import { NextResponse } from "next/server";
import { requireProducerSession } from "@/app/api/utils/customer-portal-auth";
import sql from "@/app/api/utils/sql";

export async function GET() {
  const auth = await requireProducerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const name = auth.session.producerName;
  try {
    const orders = await sql`SELECT * FROM cutting_orders WHERE producer_name ILIKE ${'%' + name + '%'} ORDER BY cutting_date DESC LIMIT 20`;
    const payments = await sql`SELECT * FROM producer_payments WHERE producer_name ILIKE ${'%' + name + '%'} ORDER BY created_at DESC LIMIT 20`;
    const sched = await sql`SELECT * FROM payment_schedule WHERE producer_name ILIKE ${'%' + name + '%'} ORDER BY scheduled_payment_date DESC LIMIT 10`;
    return NextResponse.json({ producer: name, orders, payments, scheduled: sched, actualizado: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo consultar" }, { status: 500 });
  }
}
