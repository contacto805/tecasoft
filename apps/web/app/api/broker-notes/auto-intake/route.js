import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Auto-link broker notes to fruit intakes when creating an intake
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      broker_name,
      total_kg_weighed,
      public_scale_date,
      notes
    } = body;

    if (!lot_id || !broker_name) {
      return NextResponse.json(
        { error: "lot_id and broker_name are required" },
        { status: 400 }
      );
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Check if there are any broker notes for this broker related to this lot
    const brokerNotes = await sql`
      SELECT * FROM broker_notes
      WHERE broker_name = ${broker_name}
      AND note_date >= ${new Date(public_scale_date || Date.now()).toISOString().split('T')[0]}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    // Create a connection entry linking broker notes to the intake
    const intakeRecord = await sql`
      INSERT INTO fruit_input_weighings (
        lot_id,
        total_kg_weighed,
        public_scale_date,
        notes,
        reception_responsible
      )
      VALUES (
        ${lot_id},
        ${total_kg_weighed || 0},
        ${public_scale_date || new Date().toISOString().split('T')[0]},
        ${notes || ''},
        ${broker_name}
      )
      RETURNING *
    `;

    return NextResponse.json({
      intake: intakeRecord[0],
      linked_broker_notes: brokerNotes,
      message: `${brokerNotes.length} notas de corredor vinculadas a este ingreso`
    });
  } catch (error) {
    console.error("Error in POST /api/broker-notes/auto-intake:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get pending broker notes for a lot that haven't been linked to an intake yet
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');
    const brokerName = searchParams.get('broker_name');

    if (!lotId || !brokerName) {
      return NextResponse.json(
        { error: "lot_id and broker_name are required" },
        { status: 400 }
      );
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Get unlinked broker notes - notes created after cutting date but not yet linked to an intake
    const lastIntake = await sql`
      SELECT MAX(public_scale_date) as last_intake_date
      FROM fruit_input_weighings
      WHERE lot_id = ${lotId}
    `;

    const lastIntakeDate = lastIntake[0]?.last_intake_date 
      ? new Date(lastIntake[0].last_intake_date).toISOString().split('T')[0]
      : lot[0].date;

    const unlinkedNotes = await sql`
      SELECT * FROM broker_notes
      WHERE broker_name = ${brokerName}
      AND note_date >= ${lastIntakeDate}
      AND note_type IN ('prestamo', 'advance', 'comprobante')
      ORDER BY note_date DESC
    `;

    return NextResponse.json({
      lot_id: lotId,
      broker_name: brokerName,
      last_intake_date: lastIntakeDate,
      pending_notes: unlinkedNotes,
      total_amount: unlinkedNotes.reduce((sum, note) => sum + (parseFloat(note.amount) || 0), 0)
    });
  } catch (error) {
    console.error("Error in GET /api/broker-notes/auto-intake:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
