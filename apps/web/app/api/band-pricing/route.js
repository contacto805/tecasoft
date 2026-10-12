import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weekDate = searchParams.get('weekDate'); // optional date to find pricing for that week

    let pricing;
    
    if (weekDate) {
      // Find pricing for the week containing the given date
      pricing = await sql`
        SELECT * FROM band_pricing 
        WHERE week_start_date <= ${weekDate}::date AND week_end_date >= ${weekDate}::date
        ORDER BY week_start_date DESC
        LIMIT 1
      `;
    } else {
      // Get current week's pricing
      pricing = await sql`
        SELECT * FROM band_pricing 
        WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE
        ORDER BY week_start_date DESC
        LIMIT 1
      `;
    }

    return NextResponse.json(pricing.length > 0 ? pricing[0] : null);
  } catch (error) {
    console.error('Error fetching band pricing:', error);
    return NextResponse.json(
      { error: 'Error fetching band pricing' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { week_start_date, week_end_date, price_per_kg, currency, notes } = await request.json();

    if (!week_start_date || !week_end_date || price_per_kg === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO band_pricing (week_start_date, week_end_date, price_per_kg, currency, notes)
      VALUES (${week_start_date}::date, ${week_end_date}::date, ${price_per_kg}, ${currency || 'MXN'}, ${notes || ''})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating band pricing:', error);
    return NextResponse.json(
      { error: 'Error creating band pricing' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, week_start_date, week_end_date, price_per_kg, currency, notes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Band pricing ID required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE band_pricing
      SET 
        week_start_date = COALESCE(${week_start_date}::date, week_start_date),
        week_end_date = COALESCE(${week_end_date}::date, week_end_date),
        price_per_kg = COALESCE(${price_per_kg}, price_per_kg),
        currency = COALESCE(${currency}, currency),
        notes = COALESCE(${notes}, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating band pricing:', error);
    return NextResponse.json(
      { error: 'Error updating band pricing' },
      { status: 500 }
    );
  }
}
