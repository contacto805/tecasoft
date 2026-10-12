import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const intakes = await sql`
      SELECT fi.*, l.lot_number, l.producer 
      FROM fruit_intake fi
      LEFT JOIN lots l ON fi.lot_id = l.id
      ORDER BY fi.timestamp DESC
      LIMIT 100
    `;
    return NextResponse.json(intakes);
  } catch (error) {
    console.error("Error fetching intakes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { lot_id, weight_kg, timestamp } = await request.json();

    const result = await sql`
      INSERT INTO fruit_intake (lot_id, weight_kg, timestamp)
      VALUES (${lot_id}, ${weight_kg}, ${timestamp})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating intake:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
