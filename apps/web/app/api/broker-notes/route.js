import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const brokerName = searchParams.get('brokerName');

  try {
    let notes;
    
    if (brokerName) {
      notes = await sql`
        SELECT * FROM broker_notes 
        WHERE broker_name = ${brokerName}
        ORDER BY note_date DESC, created_at DESC
      `;
    } else {
      notes = await sql`
        SELECT * FROM broker_notes 
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching broker notes:', error);
    return NextResponse.json({ error: 'Failed to fetch broker notes' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { brokerName, noteType, description, amount, noteDate } = await request.json();

    const result = await sql`
      INSERT INTO broker_notes (broker_name, note_type, description, amount, note_date)
      VALUES (${brokerName}, ${noteType}, ${description}, ${amount || 0}, ${noteDate})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating broker note:', error);
    return NextResponse.json({ error: 'Failed to create broker note' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, broker_name, note_type, description, amount, note_date } = await request.json();

    const result = await sql`
      UPDATE broker_notes 
      SET broker_name = ${broker_name},
          note_type = ${note_type},
          description = ${description},
          amount = ${amount || 0},
          note_date = ${note_date}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating broker note:', error);
    return NextResponse.json({ error: 'Failed to update broker note' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    await sql`DELETE FROM broker_notes WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting broker note:', error);
    return NextResponse.json({ error: 'Failed to delete broker note' }, { status: 500 });
  }
}
