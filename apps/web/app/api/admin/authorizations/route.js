import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener solicitudes de autorización
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pendiente';
    const requestType = searchParams.get('requestType');
    const module = searchParams.get('module');
    const priority = searchParams.get('priority');

    let where = sql`WHERE status = ${status}`;
    
    if (requestType) {
      where = sql`${where} AND request_type = ${requestType}`;
    }
    
    if (module) {
      where = sql`${where} AND module = ${module}`;
    }
    
    if (priority) {
      where = sql`${where} AND priority = ${priority}`;
    }

    const requests = await sql`
      SELECT * FROM authorization_requests
      ${where}
      ORDER BY 
        CASE priority
          WHEN 'alta' THEN 1
          WHEN 'media' THEN 2
          WHEN 'baja' THEN 3
        END,
        requested_at DESC
    `;

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching authorization requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear solicitud de autorización
export async function POST(request) {
  try {
    const {
      requestType,
      module,
      entityType,
      entityId,
      requestedBy,
      title,
      description,
      originalData,
      requestedData,
      amount,
      priority = 'media'
    } = await request.json();

    if (!requestType || !module || !requestedBy || !title) {
      return NextResponse.json(
        { error: 'Campos requeridos: requestType, module, requestedBy, title' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO authorization_requests (
        request_type,
        module,
        entity_type,
        entity_id,
        requested_by,
        title,
        description,
        original_data,
        requested_data,
        amount,
        priority,
        status
      )
      VALUES (
        ${requestType},
        ${module},
        ${entityType || null},
        ${entityId || null},
        ${requestedBy},
        ${title},
        ${description || null},
        ${originalData ? JSON.stringify(originalData) : null},
        ${requestedData ? JSON.stringify(requestedData) : null},
        ${amount || null},
        ${priority},
        'pendiente'
      )
      RETURNING *
    `;

    // Crear alerta para el administrador
    await sql`
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
        'autorizacion_pendiente',
        ${priority},
        ${module},
        ${title},
        ${description || 'Nueva solicitud de autorización pendiente'},
        'authorization_request',
        ${result.id},
        ARRAY['super_admin']::TEXT[],
        'activa'
      )
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating authorization request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Aprobar/Rechazar solicitud
export async function PUT(request) {
  try {
    const { id, action, reviewedBy, reviewNotes } = await request.json();

    if (!id || !action || !reviewedBy) {
      return NextResponse.json(
        { error: 'id, action y reviewedBy son requeridos' },
        { status: 400 }
      );
    }

    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser "aprobar" o "rechazar"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'aprobar' ? 'aprobado' : 'rechazado';

    const [result] = await sql`
      UPDATE authorization_requests
      SET 
        status = ${newStatus},
        reviewed_by = ${reviewedBy},
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = ${reviewNotes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Registrar en bitácora
    await sql`
      INSERT INTO system_audit_log (
        user_id,
        user_name,
        module,
        action,
        entity_type,
        entity_id,
        description,
        status
      )
      VALUES (
        ${reviewedBy},
        ${reviewedBy},
        'autorizaciones',
        ${action},
        'authorization_request',
        ${result.id},
        ${`Solicitud ${newStatus}: ${result.title}`},
        'exitoso'
      )
    `;

    // Resolver alerta relacionada
    await sql`
      UPDATE system_alerts
      SET 
        status = 'resuelta',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = ${reviewedBy},
        resolution_notes = ${reviewNotes || null}
      WHERE entity_type = 'authorization_request'
        AND entity_id = ${result.id}
        AND status = 'activa'
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating authorization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Cancelar solicitud
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

    const [result] = await sql`
      UPDATE authorization_requests
      SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting authorization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
