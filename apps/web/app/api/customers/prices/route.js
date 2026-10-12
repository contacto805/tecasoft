import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const week = searchParams.get("week");

    let query = sql`SELECT * FROM customer_weekly_prices`;
    if (customerId) {
      query = sql`SELECT * FROM customer_weekly_prices WHERE customer_id = ${parseInt(customerId)}`;
      if (week) {
        // simple: get by start week
        query = sql`SELECT * FROM customer_weekly_prices WHERE customer_id = ${parseInt(customerId)} AND week_start_date <= ${week} ORDER BY week_start_date DESC LIMIT 10`;
      }
    }

    const prices = await sql`${query} ORDER BY created_at DESC`;
    return NextResponse.json(Array.isArray(prices) ? prices : []);
  } catch (error) {
    console.error("Error fetching customer prices:", error);
    return NextResponse.json({ error: "Error obteniendo precios" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { customerId, weekStartDate, weekEndDate, caliber, pricePerKg, notes } = body;

    if (!customerId) return NextResponse.json({ error: "customerId requerido" }, { status: 400 });

    // upsert simple: delete old same customer/caliber for week or insert
    const [result] = await sql`
      INSERT INTO customer_weekly_prices (customer_id, week_start_date, week_end_date, caliber, price_per_kg, notes)
      VALUES (${parseInt(customerId)}, ${weekStartDate || new Date().toISOString().slice(0,10)}, ${weekEndDate || null}, ${caliber || 'Extra'}, ${parseFloat(pricePerKg) || 0}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving customer price:", error);
    return NextResponse.json({ error: "Error guardando precio" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, pricePerKg, notes } = await request.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const [updated] = await sql`
      UPDATE customer_weekly_prices 
      SET price_per_kg = ${parseFloat(pricePerKg) || 0}, notes = ${notes || null}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Error actualizando precio" }, { status: 500 });
  }
}
