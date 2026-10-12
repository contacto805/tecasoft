import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener bitácora del sistema
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let where = sql`WHERE 1=1`;

    if (userId) {
      where = sql`${where} AND user_id = ${userId}`;
    }

    if (module) {
      where = sql`${where} AND module = ${module}`;
    }

    if (action) {
      where = sql`${where} AND action = ${action}`;
    }

    if (startDate) {
      where = sql`${where} AND timestamp >= ${startDate}`;
    }

    if (endDate) {
      where = sql`${where} AND timestamp <= ${endDate}`;
    }

    const logs = await sql`
      SELECT * FROM system_audit_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [countResult] = await sql`
      SELECT COUNT(*) as total FROM system_audit_log
      ${where}
    `;

    return NextResponse.json({
      logs,
      total: parseInt(countResult.total),
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar entrada en bitácora
export async function POST(request) {
  try {
    const {
      userId,
      userName,
      userRole,
      module,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      description,
      ipAddress,
      userAgent,
      status = 'exitoso'
    } = await request.json();

    if (!userId || !userName || !module || !action) {
      return NextResponse.json(
        { error: 'Campos requeridos: userId, userName, module, action' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO system_audit_log (
        user_id,
        user_name,
        user_role,
        module,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        description,
        ip_address,
        user_agent,
        status
      )
      VALUES (
        ${userId},
        ${userName},
        ${userRole || null},
        ${module},
        ${action},
        ${entityType || null},
        ${entityId || null},
        ${oldValue || null},
        ${newValue || null},
        ${description || null},
        ${ipAddress || null},
        ${userAgent || null},
        ${status}
      )
      RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
