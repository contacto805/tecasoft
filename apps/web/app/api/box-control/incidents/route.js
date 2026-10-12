import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Fetch incidents
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    let filters = sql``;
    if (status) {
      filters = sql`${filters} AND status = ${status}`;
    }
    if (severity) {
      filters = sql`${filters} AND severity = ${severity}`;
    }

    const incidents = await sql`
      SELECT * FROM box_control_incidents 
      WHERE 1=1 ${filters}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ success: true, incidents });
  } catch (error) {
    console.error('Error in GET /api/box-control/incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create incident
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      movement_id,
      cutting_order_id,
      lot_id,
      incident_type,
      severity,
      boxes_expected,
      boxes_received,
      title,
      description,
      priority
    } = data;

    if (!incident_type || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: incident_type, severity' },
        { status: 400 }
      );
    }

    const boxes_difference = (boxes_expected || 0) - (boxes_received || 0);

    const result = await sql`
      INSERT INTO box_control_incidents (
        movement_id, cutting_order_id, lot_id, incident_type, severity,
        boxes_expected, boxes_received, boxes_difference, title, description, priority
      )
      VALUES (
        ${movement_id || null}, ${cutting_order_id || null}, ${lot_id || null},
        ${incident_type}, ${severity}, ${boxes_expected || null}, 
        ${boxes_received || null}, ${boxes_difference}, 
        ${title || null}, ${description || null}, ${priority || 'medium'}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/box-control/incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update incident (resolve, close, etc.)
export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, status, resolution_notes, penalty_amount, penalty_responsible, penalty_applied, resolved_by } = data;

    if (!id) {
      return NextResponse.json({ error: 'Missing incident id' }, { status: 400 });
    }

    const result = await sql`
      UPDATE box_control_incidents 
      SET 
        status = ${status || 'open'},
        resolution_notes = ${resolution_notes || null},
        penalty_amount = ${penalty_amount || 0},
        penalty_responsible = ${penalty_responsible || null},
        penalty_applied = ${penalty_applied || false},
        resolved_by = ${resolved_by || null},
        resolved_at = ${status === 'resolved' || status === 'closed' ? sql`CURRENT_TIMESTAMP` : sql`NULL`},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error in PUT /api/box-control/incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete incident
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM box_control_incidents
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: result[0] });
  } catch (error) {
    console.error('Error in DELETE /api/box-control/incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
