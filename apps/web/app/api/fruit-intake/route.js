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
    const { lot_id, weight_kg, timestamp, notes } = await request.json();

    // Delegar a fuente única de recepción: fruit_input_weighings (pesaje validado)
    // fruit_intake queda como adaptador legacy / compatibilidad
    try {
      // Upsert en el documento autorizado
      const existingW = await sql`SELECT id FROM fruit_input_weighings WHERE lot_id = ${lot_id} LIMIT 1`;
      if (existingW.length) {
        await sql`
          UPDATE fruit_input_weighings 
          SET total_kg_weighed = ${parseFloat(weight_kg)}, 
              public_scale_date = ${timestamp ? timestamp.split('T')[0] : null},
              notes = COALESCE(notes, ${notes || ''}) || ' | legacy fruit-intake'
          WHERE lot_id = ${lot_id}
        `;
      } else {
        await sql`
          INSERT INTO fruit_input_weighings (lot_id, total_kg_weighed, public_scale_date, notes)
          VALUES (${lot_id}, ${parseFloat(weight_kg)}, ${timestamp ? timestamp.split('T')[0] : null}, ${notes || 'legacy fruit-intake'})
        `;
      }
    } catch (e) { console.error('fruit-intake delegate to weighings warning:', e.message); }

    const result = await sql`
      INSERT INTO fruit_intake (lot_id, weight_kg, timestamp)
      VALUES (${lot_id}, ${weight_kg}, ${timestamp})
      RETURNING *
    `;

    return NextResponse.json({ ...result[0], delegated_to: 'fruit_input_weighings (single source)' }, { status: 201 });
  } catch (error) {
    console.error("Error creating intake:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
