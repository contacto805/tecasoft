import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener historial de modificaciones
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let where = sql`WHERE 1=1`;

    if (module) {
      where = sql`${where} AND module = ${module}`;
    }
    if (entityType) {
      where = sql`${where} AND entity_type = ${entityType}`;
    }
    if (entityId) {
      where = sql`${where} AND entity_id = ${parseInt(entityId)}`;
    }
    if (userId) {
      where = sql`${where} AND user_id = ${userId}`;
    }
    if (dateFrom && dateTo) {
      where = sql`${where} AND timestamp >= ${dateFrom} AND timestamp <= ${dateTo}`;
    }

    const modifications = await sql`
      SELECT * FROM system_audit_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT 500
    `;

    return NextResponse.json(modifications);
  } catch (error) {
    console.error('Error fetching modifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Solicitar modificación (crea pending_change)
export async function POST(request) {
  try {
    const {
      changeType,
      module,
      tableName,
      recordId,
      originalData,
      newData,
      requestedBy
    } = await request.json();

    if (!changeType || !module || !tableName || !recordId || !requestedBy) {
      return NextResponse.json(
        { error: 'Campos requeridos: changeType, module, tableName, recordId, requestedBy' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO pending_changes (
        change_type,
        module,
        table_name,
        record_id,
        original_data,
        new_data,
        requested_by,
        status
      )
      VALUES (
        ${changeType},
        ${module},
        ${tableName},
        ${recordId},
        ${JSON.stringify(originalData)},
        ${JSON.stringify(newData)},
        ${requestedBy},
        'pendiente'
      )
      RETURNING *
    `;

    // Crear alerta
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
        'modificacion_pendiente',
        'media',
        ${module},
        'Modificación pendiente de aprobación',
        ${`Solicitud de modificación en ${tableName}`},
        'pending_change',
        ${result.id},
        ARRAY['super_admin']::TEXT[],
        'activa'
      )
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating modification request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Aprobar modificación y aplicar cambios
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

    // Obtener la solicitud
    const [change] = await sql`
      SELECT * FROM pending_changes WHERE id = ${parseInt(id)}
    `;

    if (!change) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const newStatus = action === 'aprobar' ? 'aprobado' : 'rechazado';

    // Actualizar el estado
    await sql`
      UPDATE pending_changes
      SET 
        status = ${newStatus},
        reviewed_by = ${reviewedBy},
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = ${reviewNotes || null}
      WHERE id = ${parseInt(id)}
    `;

    // Si se aprueba, aplicar los cambios (esto sería específico por tabla)
    if (action === 'aprobar') {
      // Registrar en bitácora
      await sql`
        INSERT INTO system_audit_log (
          user_id,
          user_name,
          module,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value,
          description,
          status
        )
        VALUES (
          ${reviewedBy},
          ${reviewedBy},
          ${change.module},
          'modificacion_aprobada',
          ${change.table_name},
          ${change.record_id},
          ${JSON.stringify(change.original_data)},
          ${JSON.stringify(change.new_data)},
          'Modificación aprobada por administrador',
          'exitoso'
        )
      `;
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error updating modification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
