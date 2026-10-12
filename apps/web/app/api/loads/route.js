import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');
    const customerId = searchParams.get('customer_id');
    const status = searchParams.get('status');

    let query;
    if (lotId) {
      query = sql`SELECT * FROM load_history WHERE lot_id = ${parseInt(lotId)} ORDER BY load_date DESC`;
    } else if (customerId) {
      query = sql`SELECT * FROM load_history WHERE customer_id = ${parseInt(customerId)} ORDER BY load_date DESC`;
    } else if (status) {
      query = sql`SELECT * FROM load_history WHERE payment_status = ${status} ORDER BY load_date DESC`;
    } else {
      query = sql`SELECT * FROM load_history ORDER BY load_date DESC LIMIT 100`;
    }

    const loads = await query;
    return NextResponse.json(loads);
  } catch (error) {
    console.error("Error fetching loads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
