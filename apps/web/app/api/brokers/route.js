import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const brokerName = searchParams.get('broker');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const mastersOnly = searchParams.get('masters') === 'true';

  if (mastersOnly) {
    try {
      const masters = await sql`
        SELECT id, name as broker_name, phone, notes, is_active 
        FROM brokers 
        WHERE is_active = true 
        ORDER BY name ASC
      `;
      return NextResponse.json(masters);
    } catch (e) {
      return NextResponse.json([]);
    }
  }

  try {
    let query = sql`
      SELECT 
        l.collector_name as broker_name,
        COUNT(l.id) as total_lots,
        SUM(COALESCE(w.net_weight, 0)) as total_kilos,
        AVG(l.commission_amount) as commission_percentage,
        SUM(COALESCE(w.net_weight, 0) * COALESCE(l.commission_amount, 0)) as total_commission,
        json_agg(
          json_build_object(
            'lot_id', l.id,
            'lot_number', l.lot_number,
            'producer', l.producer,
            'date', l.date,
            'fruit_price', l.fruit_price,
            'kilos', COALESCE(w.net_weight, 0),
            'commission_amount', l.commission_amount,
            'total_commission', COALESCE(w.net_weight, 0) * COALESCE(l.commission_amount, 0),
            'is_paid', COALESCE(bp.is_paid, false),
            'paid_date', bp.paid_date
          ) ORDER BY l.date DESC
        ) as lots
      FROM lots l
      LEFT JOIN (
        SELECT lot_id, SUM(net_weight) as net_weight
        FROM weighings
        GROUP BY lot_id
      ) w ON l.id = w.lot_id
      LEFT JOIN broker_payments bp ON l.id = bp.lot_id
      WHERE l.collector_name IS NOT NULL AND l.collector_name != ''
    `;

    // Add filters
    const conditions = [];
    const params = [];

    if (brokerName) {
      query = sql`${query} AND LOWER(l.collector_name) LIKE LOWER(${'%' + brokerName + '%'})`;
    }
    
    if (fromDate) {
      query = sql`${query} AND l.date >= ${fromDate}`;
    }
    
    if (toDate) {
      query = sql`${query} AND l.date <= ${toDate}`;
    }

    query = sql`
      ${query}
      GROUP BY l.collector_name
      ORDER BY l.collector_name
    `;

    const brokers = await query;

    return NextResponse.json(brokers);
  } catch (error) {
    console.error('Error fetching broker data:', error);
    return NextResponse.json({ error: 'Failed to fetch broker data' }, { status: 500 });
  }
}

// Mark commission as paid or create master corredor
export async function POST(request) {
  try {
    const body = await request.json();

    // Create or update master corredor from Superadmin or other modules
    if (body.name) {
      const [row] = await sql`
        INSERT INTO brokers (name, phone, notes, email)
        VALUES (${body.name}, ${body.phone || null}, ${body.notes || null}, ${body.email || null})
        ON CONFLICT (name) DO UPDATE SET 
          phone = COALESCE(${body.phone}, brokers.phone),
          notes = COALESCE(${body.notes}, brokers.notes),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name as broker_name, phone, notes
      `;
      return NextResponse.json(row || { success: true });
    }

    const { lotId, isPaid, paidDate } = body;

    // Check if payment record exists
    const existing = await sql`
      SELECT id FROM broker_payments WHERE lot_id = ${lotId}
    `;

    if (existing.length > 0) {
      // Update existing record
      await sql`
        UPDATE broker_payments 
        SET is_paid = ${isPaid}, paid_date = ${paidDate}, updated_at = CURRENT_TIMESTAMP
        WHERE lot_id = ${lotId}
      `;
    } else {
      // Insert new record
      await sql`
        INSERT INTO broker_payments (lot_id, is_paid, paid_date)
        VALUES (${lotId}, ${isPaid}, ${paidDate})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in brokers POST:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

// Update master corredor
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, phone, notes, email } = body;
    if (!id && !name) {
      return NextResponse.json({ error: 'id or name required' }, { status: 400 });
    }
    const [row] = await sql`
      UPDATE brokers SET 
        name = COALESCE(${name}, name),
        phone = COALESCE(${phone}, phone),
        notes = COALESCE(${notes}, notes),
        email = COALESCE(${email}, email),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id || 0}
      RETURNING id, name as broker_name, phone, notes, email
    `;
    return NextResponse.json(row || { success: true });
  } catch (error) {
    console.error('Error in brokers PUT:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// Delete master corredor
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await sql`DELETE FROM brokers WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in brokers DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
