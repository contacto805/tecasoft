import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getMexicoCityTime } from "@/app/api/utils/mexico-time";

// Core engine: calculate effective hours, incidents, discounts for a day
export async function calculateDayAttendance(employee, date, recordsForDay, salaryDaily) {
  const daily = parseFloat(salaryDaily || employee.daily_salary || 0) || 0;
  const empId = employee.employee_id || employee.id;

  // 1. Resolve assigned schedule (employee level priority)
  let schedule = null;
  if (employee.current_schedule_id) {
    const sch = await sql`SELECT * FROM attendance_schedules WHERE id = ${employee.current_schedule_id} AND is_active = true LIMIT 1`;
    schedule = sch[0];
  }
  if (!schedule) {
    // Use configured default or first active (central source of truth from attendance_schedules)
    let defaultId = null;
    try {
      const defCfg = await sql`SELECT config_value FROM attendance_config WHERE config_key = 'DEFAULT_SCHEDULE_FIJO_COMPLETO' LIMIT 1`;
      defaultId = defCfg[0]?.config_value ? parseInt(defCfg[0].config_value) : null;
    } catch(e){}
    if (defaultId) {
      const schDef = await sql`SELECT * FROM attendance_schedules WHERE id = ${defaultId} AND is_active = true LIMIT 1`;
      schedule = schDef[0];
    }
    if (!schedule) {
      const defs = await sql`SELECT * FROM attendance_schedules WHERE is_active = true ORDER BY id LIMIT 1`;
      schedule = defs[0] || { schedule_type: 'fijo', jornada_type: 'completa', scheduled_entry: '09:00', scheduled_exit: '18:00', unpaid_meal_minutes: 60, required_effective_hours: 8 };
    }
  }

  const schedType = schedule.schedule_type || 'fijo';
  const jornType = schedule.jornada_type || 'completa';
  const requiredHrs = parseFloat(schedule.required_effective_hours || (jornType === 'media' ? 4 : 8));
  const unpaidMeal = parseInt(schedule.unpaid_meal_minutes || 60);

  // 2. Aggregate intervals from records (support multiple in/out)
  let totalMinutes = 0;
  let firstIn = null;
  let lastOut = null;
  const intervals = [];

  const sorted = [...recordsForDay].sort((a,b) => new Date(a.check_in_time || a.date) - new Date(b.check_in_time || b.date));
  let openIn = null;

  for (const r of sorted) {
    if (r.check_in_time) {
      if (!openIn) openIn = new Date(r.check_in_time);
      if (!firstIn) firstIn = openIn;
    }
    if (r.check_out_time && openIn) {
      const out = new Date(r.check_out_time);
      const mins = Math.max(0, (out - openIn) / 60000);
      intervals.push({ start: openIn, end: out, mins });
      totalMinutes += mins;
      lastOut = out;
      openIn = null;
    }
  }
  if (openIn && !lastOut) {
    // open shift, use now or end of day
    const { time: mx } = getMexicoCityTime();
    const tentative = new Date(`${date}T${mx}`);
    const mins = Math.max(0, (tentative - openIn) / 60000);
    totalMinutes += mins;
    lastOut = tentative;
  }

  let effectiveHours = totalMinutes / 60;

  // 3. Meal subtraction rules (per spec)
  let mealDeducted = 0;
  const hasValidatedReal = recordsForDay.some(r => r.hours_worked && parseFloat(r.hours_worked) > 0 && r.is_manual === false);
  const workedLessThanMealThreshold = effectiveHours < 5;
  const noMealConfigured = unpaidMeal <= 0 || schedule.jornada_type === 'media';

  if (!hasValidatedReal && !workedLessThanMealThreshold && !noMealConfigured && effectiveHours > 4) {
    mealDeducted = Math.min(unpaidMeal, 60);
    effectiveHours = Math.max(0, effectiveHours - (mealDeducted / 60));
  }

  // 4. Classification & discount logic
  let retardoM = 0;
  let earlyM = 0;
  let discount = 0;
  let incidents = [];
  let jornadaPagable = 'insuficiente';
  let ordinary = 0;

  const configRes = await sql`SELECT * FROM attendance_config WHERE config_key = 'UN_SOLO_DESCUENTO_DIARIO'`;
  const unSolo = (configRes[0]?.config_value || 'true') === 'true';

  if (schedType === 'fijo') {
    const schedIn = schedule.scheduled_entry || '09:00';
    const schedOut = schedule.scheduled_exit || '18:00';
    const tolIn = parseInt(schedule.tolerance_entry_min || 10);
    const thrRet = parseInt(schedule.retardo_threshold_min || 15);
    const tolOut = parseInt(schedule.tolerance_exit_min || 10);
    const thrEarly = parseInt(schedule.early_exit_threshold_min || 15);

    if (firstIn && schedIn) {
      const [sh, sm] = schedIn.split(':').map(Number);
      const schedDate = new Date(`${date}T${sh.toString().padStart(2,'0')}:${sm.toString().padStart(2,'0')}:00`);
      const actualInMin = (firstIn - schedDate) / 60000;
      if (actualInMin > tolIn) {
        retardoM = Math.round(Math.max(0, actualInMin - tolIn));
        if (retardoM >= thrRet) {
          incidents.push({ type: 'retardo_con_descuento', diff: retardoM, proposed: daily * 0.5 });
        } else {
          incidents.push({ type: 'retardo_tolerancia', diff: retardoM });
        }
      }
    }

    if (lastOut && schedOut) {
      const [eh, em] = schedOut.split(':').map(Number);
      const schedOutD = new Date(`${date}T${eh.toString().padStart(2,'0')}:${em.toString().padStart(2,'0')}:00`);
      const earlyDiff = (schedOutD - lastOut) / 60000;
      if (earlyDiff > tolOut) {
        earlyM = Math.round(Math.max(0, earlyDiff - tolOut));
        if (earlyM >= thrEarly) {
          incidents.push({ type: 'salida_anticipada_con_descuento', diff: earlyM, proposed: daily * 0.5 });
        } else {
          incidents.push({ type: 'salida_anticipada_tolerancia', diff: earlyM });
        }
      }
    }

    // Apply discounts (avoid double)
    const retInc = incidents.find(i => i.type.includes('retardo') && i.proposed);
    const earlyInc = incidents.find(i => i.type.includes('salida_anticipada') && i.proposed);
    if (retInc && earlyInc && unSolo) {
      discount = daily * 0.5;
      // mark both but apply only once
      incidents.forEach(i => { if (i.proposed) i.discount_authorized = 0; });
    } else if (retInc || earlyInc) {
      discount = daily * 0.5;
    }
  } else {
    // FLEXIBLE: only effective hours matter, no clock retardo/early
    // no retardo by entry, no salida anticipada by exit
  }

  // 5. Jornada classification
  const tolHrs = 0.17; // ~10 min tolerance
  if (effectiveHours >= (requiredHrs - tolHrs)) {
    jornadaPagable = (jornType === 'media') ? 'medio_turno' : 'turno_completo';
    ordinary = (jornType === 'media') ? 4 : 8;
  } else if (effectiveHours >= 4 - tolHrs) {
    jornadaPagable = 'medio_turno';
    ordinary = 4;
  } else if (effectiveHours > 0.1) {
    jornadaPagable = 'jornada_insuficiente';
  } else {
    jornadaPagable = 'falta';
  }

  // 6. Extra (after ordinary)
  let extra = Math.max(0, effectiveHours - ordinary);

  // 7. Build enriched
  const enriched = {
    ...recordsForDay[0] || {},
    schedule_type: schedType,
    jornada_type: jornType,
    effective_hours: parseFloat(effectiveHours.toFixed(2)),
    ordinary_hours: ordinary,
    extra_hours: parseFloat(extra.toFixed(2)),
    meal_minutes: mealDeducted,
    retardo_minutes: retardoM,
    early_exit_minutes: earlyM,
    discount_amount: parseFloat(discount.toFixed(2)),
    jornada_pagable: jornadaPagable,
    status: recordsForDay[0]?.status || (effectiveHours > 0.1 ? 'presente' : 'ausente')
  };

  return { enriched, incidents, scheduleUsed: schedule };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, date, forceRecalc, configUpdate } = body;

    if (configUpdate && configUpdate.key) {
      // Allow config updates from central settings (UN_SOLO_DESCUENTO etc)
      await sql`
        INSERT INTO attendance_config (config_key, config_value, description, updated_at)
        VALUES (${configUpdate.key}, ${String(configUpdate.value)}, 'Actualizado desde Configuraciones', CURRENT_TIMESTAMP)
        ON CONFLICT (config_key) DO UPDATE SET config_value = ${String(configUpdate.value)}, updated_at = CURRENT_TIMESTAMP
      `;
      return NextResponse.json({ success: true, config: configUpdate });
    }

    if (!employeeId || !date) {
      return NextResponse.json({ error: 'employeeId y date requeridos' }, { status: 400 });
    }

    const [emp] = await sql`SELECT * FROM employee_profiles WHERE employee_id = ${employeeId} LIMIT 1`;
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const atts = await sql`SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${date}`;
    const dailySal = emp.daily_salary || 0;

    const { enriched, incidents } = await calculateDayAttendance(emp, date, atts, dailySal);

    // Persist enriched values
    if (atts.length > 0) {
      await sql`
        UPDATE attendance_records SET
          schedule_type = ${enriched.schedule_type},
          jornada_type = ${enriched.jornada_type},
          effective_hours = ${enriched.effective_hours},
          ordinary_hours = ${enriched.ordinary_hours},
          extra_hours = ${enriched.extra_hours},
          meal_minutes = ${enriched.meal_minutes},
          retardo_minutes = ${enriched.retardo_minutes},
          early_exit_minutes = ${enriched.early_exit_minutes},
          discount_amount = ${enriched.discount_amount},
          jornada_pagable = ${enriched.jornada_pagable},
          status = ${enriched.status},
          hours_worked = ${enriched.effective_hours},
          late_minutes = ${enriched.retardo_minutes},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${atts[0].id}
      `;
    }

    // Persist incidents (only new)
    for (const inc of incidents) {
      await sql`
        INSERT INTO attendance_incidents (employee_id, date, incident_type, schedule_type, jornada_type, difference, discount_proposed)
        VALUES (${employeeId}, ${date}, ${inc.type}, ${enriched.schedule_type}, ${enriched.jornada_type}, ${inc.diff || 0}, ${inc.proposed || 0})
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({ success: true, record: enriched, incidents });
  } catch (e) {
    console.error('calc error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const date = searchParams.get('date');
  if (!employeeId || !date) return NextResponse.json({ error: 'params requeridos' }, { status: 400 });

  const [emp] = await sql`SELECT * FROM employee_profiles WHERE employee_id = ${employeeId}`;
  const atts = await sql`SELECT * FROM attendance_records WHERE employee_id=${employeeId} AND date=${date}`;
  const { enriched, incidents } = await calculateDayAttendance(emp || {}, date, atts, emp?.daily_salary);
  return NextResponse.json({ record: enriched, incidents });
}
