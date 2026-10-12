import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: list all schedules (active + inactive for management). ?includeConfig=1 to also get attendance_config
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const schedules = await sql`
      SELECT * FROM attendance_schedules 
      ORDER BY is_active DESC, id ASC
    `;
    if (searchParams.get('includeConfig') === '1') {
      const configs = await sql`SELECT config_key, config_value FROM attendance_config`;
      return NextResponse.json({ schedules, configs });
    }
    return NextResponse.json(schedules);
  } catch (e) {
    console.error('schedules list error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: create new schedule
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      schedule_type = 'fijo',
      jornada_type = 'completa',
      scheduled_entry,
      scheduled_exit,
      meal_start,
      meal_end,
      unpaid_meal_minutes = 60,
      tolerance_entry_min = 10,
      retardo_threshold_min = 15,
      tolerance_exit_min = 10,
      early_exit_threshold_min = 15,
      required_effective_hours = 8,
      min_entry_time,
      max_exit_time,
      max_meal_minutes = 60,
      allow_multiple_entries = false,
      round_minutes = 1,
      work_days = ['monday','tuesday','wednesday','thursday','friday','saturday'],
      rest_day,
      is_active = true
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO attendance_schedules (
        name, schedule_type, jornada_type, scheduled_entry, scheduled_exit,
        meal_start, meal_end, unpaid_meal_minutes, tolerance_entry_min, retardo_threshold_min,
        tolerance_exit_min, early_exit_threshold_min, required_effective_hours,
        min_entry_time, max_exit_time, max_meal_minutes, allow_multiple_entries,
        round_minutes, work_days, rest_day, is_active
      ) VALUES (
        ${name}, ${schedule_type}, ${jornada_type}, ${scheduled_entry || null}, ${scheduled_exit || null},
        ${meal_start || null}, ${meal_end || null}, ${parseInt(unpaid_meal_minutes)||0}, ${parseInt(tolerance_entry_min)||10}, ${parseInt(retardo_threshold_min)||15},
        ${parseInt(tolerance_exit_min)||10}, ${parseInt(early_exit_threshold_min)||15}, ${parseFloat(required_effective_hours)||8},
        ${min_entry_time || null}, ${max_exit_time || null}, ${parseInt(max_meal_minutes)||60}, ${!!allow_multiple_entries},
        ${parseInt(round_minutes)||1}, ${JSON.stringify(work_days)}, ${rest_day || null}, ${!!is_active}
      ) RETURNING *
    `;

    return NextResponse.json({ success: true, schedule: created });
  } catch (e) {
    console.error('create schedule error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: update existing schedule
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const [current] = await sql`SELECT * FROM attendance_schedules WHERE id = ${id}`;
    if (!current) return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 });

    const updateFields = [];
    const values = [];

    const allowed = [
      'name', 'schedule_type', 'jornada_type', 'scheduled_entry', 'scheduled_exit',
      'meal_start', 'meal_end', 'unpaid_meal_minutes', 'tolerance_entry_min', 'retardo_threshold_min',
      'tolerance_exit_min', 'early_exit_threshold_min', 'required_effective_hours',
      'min_entry_time', 'max_exit_time', 'max_meal_minutes', 'allow_multiple_entries',
      'round_minutes', 'work_days', 'rest_day', 'is_active'
    ];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        let val = fields[key];
        if (key === 'work_days' && Array.isArray(val)) val = JSON.stringify(val);
        if (['unpaid_meal_minutes','tolerance_entry_min','retardo_threshold_min','tolerance_exit_min','early_exit_threshold_min','max_meal_minutes','round_minutes'].includes(key)) val = parseInt(val) || 0;
        if (['required_effective_hours'].includes(key)) val = parseFloat(val) || 0;
        if (['allow_multiple_entries','is_active'].includes(key)) val = !!val;
        updateFields.push(`${key} = $${updateFields.length + 1}`);
        values.push(val);
      }
    }

    const [updated] = await sql`
      UPDATE attendance_schedules SET
        name = ${fields.name !== undefined ? fields.name : current.name},
        schedule_type = ${fields.schedule_type !== undefined ? fields.schedule_type : current.schedule_type},
        jornada_type = ${fields.jornada_type !== undefined ? fields.jornada_type : current.jornada_type},
        scheduled_entry = ${fields.scheduled_entry !== undefined ? fields.scheduled_entry : current.scheduled_entry},
        scheduled_exit = ${fields.scheduled_exit !== undefined ? fields.scheduled_exit : current.scheduled_exit},
        meal_start = ${fields.meal_start !== undefined ? fields.meal_start : current.meal_start},
        meal_end = ${fields.meal_end !== undefined ? fields.meal_end : current.meal_end},
        unpaid_meal_minutes = ${fields.unpaid_meal_minutes !== undefined ? parseInt(fields.unpaid_meal_minutes) : current.unpaid_meal_minutes},
        tolerance_entry_min = ${fields.tolerance_entry_min !== undefined ? parseInt(fields.tolerance_entry_min) : current.tolerance_entry_min},
        retardo_threshold_min = ${fields.retardo_threshold_min !== undefined ? parseInt(fields.retardo_threshold_min) : current.retardo_threshold_min},
        tolerance_exit_min = ${fields.tolerance_exit_min !== undefined ? parseInt(fields.tolerance_exit_min) : current.tolerance_exit_min},
        early_exit_threshold_min = ${fields.early_exit_threshold_min !== undefined ? parseInt(fields.early_exit_threshold_min) : current.early_exit_threshold_min},
        required_effective_hours = ${fields.required_effective_hours !== undefined ? parseFloat(fields.required_effective_hours) : current.required_effective_hours},
        min_entry_time = ${fields.min_entry_time !== undefined ? fields.min_entry_time : current.min_entry_time},
        max_exit_time = ${fields.max_exit_time !== undefined ? fields.max_exit_time : current.max_exit_time},
        max_meal_minutes = ${fields.max_meal_minutes !== undefined ? parseInt(fields.max_meal_minutes) : current.max_meal_minutes},
        allow_multiple_entries = ${fields.allow_multiple_entries !== undefined ? !!fields.allow_multiple_entries : current.allow_multiple_entries},
        round_minutes = ${fields.round_minutes !== undefined ? parseInt(fields.round_minutes) : current.round_minutes},
        work_days = ${fields.work_days !== undefined ? JSON.stringify(fields.work_days) : current.work_days},
        rest_day = ${fields.rest_day !== undefined ? fields.rest_day : current.rest_day},
        is_active = ${fields.is_active !== undefined ? !!fields.is_active : current.is_active},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ success: true, schedule: updated });
  } catch (e) {
    console.error('update schedule error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: deactivate schedule (soft)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    await sql`UPDATE attendance_schedules SET is_active = false WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
