import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerTripId = searchParams.get('customerTripId');

  try {
    if (!customerTripId) {
      return NextResponse.json({ error: 'customerTripId is required' }, { status: 400 });
    }

    const payments = await sql`
      SELECT * FROM customer_trip_payments 
      WHERE customer_trip_id = ${parseInt(customerTripId)}
      ORDER BY payment_date DESC
    `;

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { customerTripId, paymentDate, amountPaid, paymentProofUrl, notes } = await request.json();

    const result = await sql`
      INSERT INTO customer_trip_payments (
        customer_trip_id, payment_date, amount_paid, payment_proof_url, notes
      ) VALUES (
        ${parseInt(customerTripId)}, 
        ${paymentDate}, 
        ${parseFloat(amountPaid)}, 
        ${paymentProofUrl || null}, 
        ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await sql`DELETE FROM customer_trip_payments WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
