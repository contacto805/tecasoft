import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener registros de auditoría
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    let where = sql``;
    const conditions = [];

    if (module) {
      conditions.push(sql`module = ${module}`);
    }
    if (userId) {
      conditions.push(sql`user_id = ${userId}`);
    }
    if (action) {
      conditions.push(sql`action = ${action}`);
    }
    if (startDate && endDate) {
      conditions.push(sql`timestamp >= ${startDate} AND timestamp <= ${endDate}`);
    } else if (startDate) {
      conditions.push(sql`timestamp >= ${startDate}`);
    } else if (endDate) {
      conditions.push(sql`timestamp <= ${endDate}`);
    }

    if (conditions.length > 0) {
      where = sql`WHERE ${conditions[0]}`;
      for (let i = 1; i < conditions.length; i++) {
        where = sql`${where} AND ${conditions[i]}`;
      }
    }

    const auditLogs = await sql`
      SELECT * FROM system_audit_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(auditLogs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear registro de auditoría manual
export async function POST(request) {
  try {
    const { 
      user_id, 
      user_name, 
      user_role, 
      module, 
      action, 
      entity_type, 
      entity_id, 
      description,
      ip_address,
      user_agent 
    } = await request.json();

    const [log] = await sql`
      INSERT INTO system_audit_log 
      (user_id, user_name, user_role, module, action, entity_type, entity_id, description, ip_address, user_agent, status, timestamp)
      VALUES (${user_id}, ${user_name}, ${user_role}, ${module}, ${action}, ${entity_type}, ${entity_id}, ${description}, ${ip_address}, ${user_agent}, 'success', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
