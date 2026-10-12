import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get all lots with their total kg from weighings
    const lotsData = await sql`
      SELECT 
        l.id,
        l.lot_number,
        l.producer,
        l.origin,
        l.orchard_name,
        l.fruit_type,
        COALESCE(SUM(w.net_weight), 0) as total_kg,
        l.status
      FROM lots l
      LEFT JOIN weighings w ON l.id = w.lot_id
      WHERE l.status = 'selection'
      GROUP BY l.id, l.lot_number, l.producer, l.origin, l.orchard_name, l.fruit_type, l.status
      ORDER BY l.created_at DESC
    `;

    return NextResponse.json(lotsData);
  } catch (error) {
    console.error('Error fetching batch summary:', error);
    return NextResponse.json(
      { error: 'Error fetching batch summary' },
      { status: 500 }
    );
  }
}
