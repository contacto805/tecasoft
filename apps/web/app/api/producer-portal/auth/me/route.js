import { NextResponse } from "next/server";
import { requireProducerSession } from "@/app/api/utils/customer-portal-auth";
import sql from "@/app/api/utils/sql";

export async function GET() {
  const auth = await requireProducerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const identifier = auth.session.producerName;
  try {
    // Producer only sees own data - lookup by name or number via portal if needed, but filter strictly on identifier
    const orders = await sql`SELECT * FROM cutting_orders WHERE producer_name ILIKE ${'%' + identifier + '%'} ORDER BY cutting_date DESC LIMIT 20`;
    const payments = await sql`SELECT * FROM producer_payments WHERE producer_name ILIKE ${'%' + identifier + '%'} ORDER BY created_at DESC LIMIT 20`;
    const sched = await sql`SELECT * FROM payment_schedule WHERE producer_name ILIKE ${'%' + identifier + '%'} ORDER BY scheduled_payment_date DESC LIMIT 10`;
    // Also fetch own portal record for number/phone display (no PIN)
    const [portal] = await sql`SELECT producer_number, producer_name, whatsapp_phone, is_enabled, last_login_at FROM producer_portal_access WHERE producer_name = ${identifier} OR producer_number = ${identifier} LIMIT 1`;
    return NextResponse.json({ 
      producer: portal?.producer_name || identifier, 
      producerNumber: portal?.producer_number || null,
      whatsapp: portal?.whatsapp_phone || null,
      orders, 
      payments, 
      scheduled: sched, 
      actualizado: new Date().toISOString() 
    });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo consultar" }, { status: 500 });
  }
}
