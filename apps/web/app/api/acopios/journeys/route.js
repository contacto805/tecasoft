import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const logs = await sql`SELECT * FROM journey_logs ORDER BY date DESC LIMIT 30`;
    const fuels = await sql`SELECT * FROM fuel_logs ORDER BY date DESC LIMIT 30`;
    return NextResponse.json({ journeys: logs, fuels });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type } = body;
    if (type === 'journey') {
      const j = body.journey;
      const [row] = await sql`
        INSERT INTO journey_logs (user_id, date, km_initial, km_final, photo_start_url, photo_end_url, total_km, gps_points)
        VALUES (${j.user_id || 'acopiador'}, ${j.date || new Date().toISOString().split('T')[0]},
                ${j.km_initial || 0}, ${j.km_final || 0}, ${j.photo_start_url || ''}, ${j.photo_end_url || ''},
                ${j.total_km || 0}, ${JSON.stringify(j.gps_points || [])} )
        RETURNING *
      `;
      return NextResponse.json(row);
    } else if (type === 'fuel') {
      const f = body.fuel;
      const [r] = await sql`
        INSERT INTO fuel_logs (date, vehicle, liters, cost, photo_ticket_url, station, km_at_load, user_id)
        VALUES (${f.date}, ${f.vehicle}, ${f.liters}, ${f.cost}, ${f.photo_ticket_url || ''}, ${f.station}, ${f.km_at_load}, ${f.user_id || ''})
        RETURNING *
      `;
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "type journey|fuel" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
