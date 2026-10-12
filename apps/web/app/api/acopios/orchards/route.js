import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT o.*, 
        (SELECT COUNT(*) FROM orchard_visits v WHERE v.orchard_name = o.name) as visit_count
      FROM orchards o 
      ORDER BY o.created_at DESC 
      LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name, producer, broker, municipality, locality, state,
      lat, lng, alt, status, notes
    } = body;
    if (!name) return NextResponse.json({ error: "Nombre de huerta requerido" }, { status: 400 });
    const [row] = await sql`
      INSERT INTO orchards (name, producer, broker, municipality, locality, state, lat, lng, alt, status, notes)
      VALUES (${name}, ${producer || null}, ${broker || null}, ${municipality || null}, ${locality || null}, ${state || null},
              ${lat || null}, ${lng || null}, ${alt || null}, ${status || 'Activo'}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, ...updates } = await request.json();
    const [row] = await sql`
      UPDATE orchards SET 
        name = COALESCE(${updates.name}, name),
        producer = COALESCE(${updates.producer}, producer),
        broker = COALESCE(${updates.broker}, broker),
        municipality = COALESCE(${updates.municipality}, municipality),
        lat = COALESCE(${updates.lat}, lat),
        lng = COALESCE(${updates.lng}, lng),
        status = COALESCE(${updates.status}, status),
        notes = COALESCE(${updates.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
