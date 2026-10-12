import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  try {
    let query;
    
    if (customerId) {
      // Get trips for a specific customer
      query = sql`
        SELECT 
          ct.*,
          c.customer_name,
          c.destination,
          c.rfc,
          (SELECT COALESCE(SUM(amount_paid), 0) FROM customer_trip_payments WHERE customer_trip_id = ct.id) as total_paid,
          (SELECT COUNT(*) FROM customer_trip_payments WHERE customer_trip_id = ct.id) as payment_count,
          (SELECT settlement_date FROM customer_trip_settlements WHERE customer_trip_id = ct.id ORDER BY settlement_date DESC LIMIT 1) as settlement_date,
          (ct.price_per_trip - COALESCE((SELECT SUM(amount_paid) FROM customer_trip_payments WHERE customer_trip_id = ct.id), 0)) as balance
        FROM customer_trips ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.customer_id = ${parseInt(customerId)}
      `;

      if (fromDate) {
        query = sql`${query} AND ct.trip_date >= ${fromDate}`;
      }
      if (toDate) {
        query = sql`${query} AND ct.trip_date <= ${toDate}`;
      }

      query = sql`${query} ORDER BY ct.trip_date DESC`;
    } else {
      // Get all trips grouped by customer
      query = sql`
        SELECT 
          c.id as customer_id,
          c.customer_name,
          c.destination,
          c.rfc,
          COUNT(ct.id) as total_trips,
          COALESCE(SUM(ct.total_kg), 0) as total_kg,
          COALESCE(SUM(ct.boxes_count), 0) as total_boxes,
          COALESCE(SUM(ct.price_per_trip), 0) as total_revenue,
          COALESCE(SUM((SELECT SUM(amount_paid) FROM customer_trip_payments WHERE customer_trip_id = ct.id)), 0) as total_paid,
          (COALESCE(SUM(ct.price_per_trip), 0) - COALESCE(SUM((SELECT SUM(amount_paid) FROM customer_trip_payments WHERE customer_trip_id = ct.id)), 0)) as total_balance
        FROM customers c
        LEFT JOIN customer_trips ct ON c.id = ct.customer_id
      `;

      if (fromDate || toDate) {
        const conditions = [];
        if (fromDate) conditions.push(sql`ct.trip_date >= ${fromDate}`);
        if (toDate) conditions.push(sql`ct.trip_date <= ${toDate}`);
        
        if (conditions.length > 0) {
          query = sql`${query} WHERE ${conditions[0]}`;
          for (let i = 1; i < conditions.length; i++) {
            query = sql`${query} AND ${conditions[i]}`;
          }
        }
      }

      query = sql`${query} GROUP BY c.id, c.customer_name, c.destination, c.rfc ORDER BY c.customer_name`;
    }

    const trips = await query;
    return NextResponse.json(trips);
  } catch (error) {
    console.error('Error fetching customer trips:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { 
      customerId, 
      loadHistoryId, 
      tripDate, 
      totalKg, 
      boxesCount, 
      pricePerTrip, 
      currency, 
      notes 
    } = await request.json();

    const result = await sql`
      INSERT INTO customer_trips (
        customer_id, load_history_id, trip_date, total_kg, boxes_count, 
        price_per_trip, currency, notes, status
      ) VALUES (
        ${parseInt(customerId)}, 
        ${loadHistoryId ? parseInt(loadHistoryId) : null}, 
        ${tripDate}, 
        ${parseFloat(totalKg)}, 
        ${parseInt(boxesCount)}, 
        ${parseFloat(pricePerTrip)}, 
        ${currency || 'USD'}, 
        ${notes || null},
        'pending'
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating customer trip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { 
      id, 
      customerId, 
      tripDate, 
      totalKg, 
      boxesCount, 
      pricePerTrip, 
      currency, 
      notes,
      status 
    } = await request.json();

    const result = await sql`
      UPDATE customer_trips SET
        customer_id = ${parseInt(customerId)},
        trip_date = ${tripDate},
        total_kg = ${parseFloat(totalKg)},
        boxes_count = ${parseInt(boxesCount)},
        price_per_trip = ${parseFloat(pricePerTrip)},
        currency = ${currency || 'USD'},
        notes = ${notes || null},
        status = ${status || 'pending'},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating customer trip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await sql`DELETE FROM customer_trips WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer trip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
