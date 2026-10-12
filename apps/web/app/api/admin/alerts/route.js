import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener alertas del sistema
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'activa';
    const priority = searchParams.get('priority');
    const module = searchParams.get('module');
    const assignedTo = searchParams.get('assignedTo');

    let where = sql`WHERE status = ${status}`;

    if (priority) {
      where = sql`${where} AND priority = ${priority}`;
    }

    if (module) {
      where = sql`${where} AND module = ${module}`;
    }

    if (assignedTo) {
      where = sql`${where} AND ${assignedTo} = ANY(assigned_to)`;
    }

    const alerts = await sql`
      SELECT * FROM system_alerts
      ${where}
      ORDER BY 
        CASE priority
          WHEN 'alta' THEN 1
          WHEN 'media' THEN 2
          WHEN 'baja' THEN 3
        END,
        created_at DESC
    `;

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json([]);
  }
}

// POST - Crear alerta
export async function POST(request) {
  try {
    const {
      alertType,
      priority,
      module,
      title,
      message,
      entityType,
      entityId,
      assignedTo
    } = await request.json();

    if (!alertType || !priority || !module || !title || !message) {
      return NextResponse.json(
        { error: 'Campos requeridos: alertType, priority, module, title, message' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO system_alerts (
        alert_type,
        priority,
        module,
        title,
        message,
        entity_type,
        entity_id,
        assigned_to,
        status
      )
      VALUES (
        ${alertType},
        ${priority},
        ${module},
        ${title},
        ${message},
        ${entityType || null},
        ${entityId || null},
        ${assignedTo ? assignedTo : ['super_admin']},
        'activa'
      )
      RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Resolver alerta
export async function PUT(request) {
  try {
    const { id, resolvedBy, resolutionNotes } = await request.json();

    if (!id || !resolvedBy) {
      return NextResponse.json(
        { error: 'id y resolvedBy son requeridos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      UPDATE system_alerts
      SET 
        status = 'resuelta',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = ${resolvedBy},
        resolution_notes = ${resolutionNotes || null}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resolving alert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar alerta
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM system_alerts WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
