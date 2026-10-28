import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - List incidents (filter by employee, date range, status pending/authorized)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status'); // 'pendiente' | 'autorizado' etc
    const weekStart = searchParams.get('weekStart');

    let where = sql`WHERE 1=1`;
    if (employeeId) where = sql`${where} AND employee_id = ${employeeId}`;
    if (startDate && endDate) where = sql`${where} AND date BETWEEN ${startDate} AND ${endDate}`;
    if (weekStart) {
      // assume weekStart to +6
      where = sql`${where} AND date >= ${weekStart} AND date < (${weekStart}::date + INTERVAL '7 days')`;
    }
    if (status) where = sql`${where} AND status = ${status}`;

    const incidents = await sql`
      SELECT * FROM attendance_incidents 
      ${where}
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `;

    return NextResponse.json(incidents);
  } catch (error) {
    console.error('Error fetching attendance incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Authorize / update incident (separate proposed vs authorized, legal review)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      discount_authorized, 
      authorized_by, 
      justification, 
      evidence,
      rule_applied,
      value_programmed,
      value_real
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id de incidente requerido' }, { status: 400 });
    }

    const [current] = await sql`SELECT * FROM attendance_incidents WHERE id = ${parseInt(id)}`;
    if (!current) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    }

    const newStatus = status || (discount_authorized != null ? 'autorizado' : current.status || 'pendiente');
    const authBy = authorized_by || current.authorized_by;
    const authAt = newStatus !== current.status ? new Date() : current.authorized_at;

    const [updated] = await sql`
      UPDATE attendance_incidents
      SET 
        status = ${newStatus},
        discount_authorized = COALESCE(${discount_authorized != null ? parseFloat(discount_authorized) : null}, discount_authorized),
        authorized_by = ${authBy || null},
        authorized_at = ${authAt},
        justification = COALESCE(${justification || null}, justification),
        evidence = COALESCE(${evidence || null}, evidence),
        rule_applied = COALESCE(${rule_applied || null}, rule_applied),
        value_programmed = COALESCE(${value_programmed || null}, value_programmed),
        value_real = COALESCE(${value_real || null}, value_real),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Optional audit
    try {
      await sql`
        INSERT INTO attendance_audit_log (attendance_record_id, action, user_id, user_name, old_data, new_data, reason)
        VALUES (null, 'incident_authorized', ${authBy || 'sistema'}, ${authBy || 'Sistema'}, 
                ${JSON.stringify(current)}, ${JSON.stringify(updated)}, ${justification || 'Autorización de incidente'})
      `;
    } catch(e){}

    return NextResponse.json({ success: true, incident: updated });
  } catch (error) {
    console.error('Error authorizing attendance incident:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create manual incident (permiso, ausencia justificada, etc with evidence)
export async function POST(request) {
  try {
    const { 
      employee_id, employee_name, date, incident_type, 
      schedule_type, jornada_type,
      difference, discount_proposed, discount_authorized,
      justification, evidence, authorized_by, status 
    } = await request.json();

    if (!employee_id || !date || !incident_type) {
      return NextResponse.json({ error: 'employee_id, date, incident_type requeridos' }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO attendance_incidents (
        employee_id, date, incident_type, schedule_type, jornada_type,
        difference, discount_proposed, discount_authorized,
        justification, evidence, status, authorized_by, authorized_at
      ) VALUES (
        ${employee_id}, ${date}, ${incident_type}, ${schedule_type || null}, ${jornada_type || null},
        ${difference != null ? parseFloat(difference) : 0}, 
        ${discount_proposed != null ? parseFloat(discount_proposed) : 0},
        ${discount_authorized != null ? parseFloat(discount_authorized) : 0},
        ${justification || null}, ${evidence || null}, 
        ${status || 'pendiente'}, ${authorized_by || null}, ${status === 'autorizado' ? new Date() : null}
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, incident: created });
  } catch (error) {
    console.error('Error creating attendance incident:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
