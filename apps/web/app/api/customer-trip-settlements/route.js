import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerTripId = searchParams.get('customerTripId');

  try {
    if (!customerTripId) {
      return NextResponse.json({ error: 'customerTripId is required' }, { status: 400 });
    }

    const settlements = await sql`
      SELECT * FROM customer_trip_settlements 
      WHERE customer_trip_id = ${parseInt(customerTripId)}
      ORDER BY settlement_date DESC
    `;

    return NextResponse.json(settlements);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { customerTripId, settlementDate, totalAmount, settlementProofUrl, notes } = await request.json();

    const result = await sql`
      INSERT INTO customer_trip_settlements (
        customer_trip_id, settlement_date, total_amount, settlement_proof_url, notes
      ) VALUES (
        ${parseInt(customerTripId)}, 
        ${settlementDate}, 
        ${parseFloat(totalAmount)}, 
        ${settlementProofUrl || null}, 
        ${notes || null}
      )
      RETURNING *
    `;

    // Update trip status to settled
    await sql`
      UPDATE customer_trips 
      SET status = 'settled', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${parseInt(customerTripId)}
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating settlement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await sql`DELETE FROM customer_trip_settlements WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
