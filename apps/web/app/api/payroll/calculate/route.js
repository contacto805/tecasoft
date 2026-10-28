import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST: Calculate attendance-fed payroll + store in new model + update/create records
// { week_start_date, week_end_date, userName }
export async function POST(request) {
  try {
    const { week_start_date, week_end_date, userName = "Sistema" } = await request.json();

    if (!week_start_date || !week_end_date) {
      return NextResponse.json({ error: "Se requieren fechas de la semana" }, { status: 400 });
    }

    // LOCK: si ya está aprobado/pagado, NO recalcular desde asistencia actual (evita cambio silencioso post-cierre)
    let [existingPeriod] = await sql`
      SELECT * FROM payroll_periods 
      WHERE week_start_date = ${week_start_date} AND week_end_date = ${week_end_date}
    `;
    if (existingPeriod && ['aprobado', 'pagado', 'parcial'].includes((existingPeriod.status || '').toLowerCase())) {
      const traces = await sql`
        SELECT * FROM payroll_attendance_calculations 
        WHERE payroll_period_id = ${existingPeriod.id}
        ORDER BY employee_name ASC
      `;
      return NextResponse.json({
        success: true,
        period_id: existingPeriod.id,
        total_amount: existingPeriod.total_amount,
        employee_count: existingPeriod.total_employees,
        calculations: traces,
        locked: true,
        message: "Período cerrado/aprobado. Se usa snapshot de trazabilidad (no se recalcula desde asistencia actual)"
      });
    }

    // 1. Fetch employees
    const employees = await sql`SELECT * FROM employee_profiles WHERE is_active = true ORDER BY employee_name ASC`;

    // 2. Fetch all attendance in range
    const attendances = await sql`
      SELECT * FROM attendance_records 
      WHERE date BETWEEN ${week_start_date} AND ${week_end_date}
      ORDER BY employee_id, date ASC
    `;

    // 2b. Incidentes AUTORIZADOS solamente afectan descuentos finales (separar propuesto vs autorizado)
    const authInc = await sql`
      SELECT * FROM attendance_incidents 
      WHERE date BETWEEN ${week_start_date} AND ${week_end_date}
        AND (status IN ('autorizado','aprobado','authorized') OR discount_authorized > 0)
    `;
    const authByEmpDate = {};
    authInc.forEach(i => {
      const k = `${i.employee_id}|${i.date}`;
      if (!authByEmpDate[k]) authByEmpDate[k] = [];
      authByEmpDate[k].push(i);
    });

    // 3. Fetch existing bonuses for week
    const bonuses = await sql`
      SELECT * FROM payroll_bonuses 
      WHERE week_start_date = ${week_start_date} 
      ORDER BY employee_id
    `;

    // 3b. Fetch active loans (prestamos/adelantos) for automatic weekly deductions - unified source of truth
    const activeLoans = await sql`
      SELECT * FROM employee_loans 
      WHERE (status IN ('aprobado','activo','active') OR status IS NULL OR status = 'pendiente')
        AND (paid_at IS NULL)
        AND COALESCE(remaining_balance, amount) > 0
    `;

    // 4. Group attendance per employee
    const attByEmp = {};
    attendances.forEach(a => {
      if (!attByEmp[a.employee_id]) attByEmp[a.employee_id] = [];
      attByEmp[a.employee_id].push(a);
    });

    // 5. Ensure/create payroll_period
    let [period] = await sql`
      SELECT * FROM payroll_periods 
      WHERE week_start_date = ${week_start_date} AND week_end_date = ${week_end_date}
    `;
    if (!period) {
      const folio = `NOM-${week_start_date.replace(/-/g, "")}`;
      [period] = await sql`
        INSERT INTO payroll_periods (week_start_date, week_end_date, folio, status, total_amount, total_employees)
        VALUES (${week_start_date}, ${week_end_date}, ${folio}, 'pendiente', 0, 0)
        RETURNING *
      `;
    }

    const periodId = period.id;
    let grandTotal = 0;
    let empCount = 0;
    const calculations = [];

    for (const emp of employees) {
      const empAtts = attByEmp[emp.employee_id] || [];
      const daily = parseFloat(emp.daily_salary || 0) || 0;
      
      // TALLY ATTENDANCE
      let daysPresent = 0;
      let daysRetardo = 0;
      let absences = 0;
      let daysJustified = 0;
      let lateTotal = 0;
      let overtime = 0;
      let hrsWorked = 0;
      const attIds = [];

      empAtts.forEach(r => {
        attIds.push(r.id);
        const st = r.status || '';
        if (st === 'presente') daysPresent++;
        else if (st === 'retardo') daysRetardo++;
        else if (st === 'falta_injustificada' || st === 'ausente') absences++;
        else if (st === 'falta_justificada' || st === 'vacaciones' || st === 'incapacidad' || st === 'permiso') daysJustified++;
        
        lateTotal += parseInt(r.late_minutes || 0);
        overtime += parseFloat(r.overtime_hours || 0);
        hrsWorked += parseFloat(r.hours_worked || 0);
      });

      const daysWorked = daysPresent + daysRetardo;
      // Prefer new engine fields when present
      let baseCalc = (daysWorked * daily);
      const useEff = empAtts.length ? Math.max(...empAtts.map(a=>parseFloat(a.effective_hours||0))) : 0;
      if (useEff >= 7.5) baseCalc = daily;
      else if (useEff >= 3.5) baseCalc = daily * 0.5;

      // SOLO descuentos AUTORIZADOS (incidents con status autorizado o discount_authorized >0)
      // Evita deducciones automáticas que puedan infringir legislación (separar propuesto/autorizado)
      let authRetardoDays = 0;
      let authAbsences = 0;
      empAtts.forEach(r => {
        const k = `${r.employee_id}|${r.date}`;
        const incs = authByEmpDate[k] || [];
        if (incs.length > 0) {
          incs.forEach(ic => {
            if ((ic.incident_type || '').includes('retardo') || (ic.discount_authorized || 0) > 0) authRetardoDays++;
            if ((ic.incident_type || '').includes('falta') || (ic.incident_type || '').includes('ausente')) authAbsences++;
          });
        } else {
          // si no hay incidente autorizado, no aplicar deducción por este día (solo proposed en attendance)
        }
      });
      // Penalty for retard (1h like existing): SOLO autorizados
      const retardoDed = (authRetardoDays * (daily / 8));

      // Deduction by absences (full days) - SOLO autorizados
      const absenceDed = authAbsences * daily;

      // Perfect attendance bonus: no faltas + no retardos (and worked at least some days)
      const perfectBonus = (absences === 0 && daysRetardo === 0 && daysWorked >= 1) ? daily : 0;

      // Bonuses from payroll_bonuses table
      const empBonuses = bonuses.filter(b => b.employee_id === emp.employee_id);
      const otherBonuses = empBonuses.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

      // Automatic loan deductions (prestamos/adelantos) for the week - from unified employee_loans source
      // NOTE: only compute for snapshot/draft. Actual balance reduction and payment record happens at APPROVE (idempotent, once).
      const empLoans = activeLoans.filter(l => String(l.employee_id) === String(emp.employee_id));
      const loanDedThisWeek = empLoans.reduce((s, l) => s + (parseFloat(l.descuento_semanal) || 0), 0);

      const grossSalary = baseCalc + perfectBonus + otherBonuses;
      const totalDeduc = absenceDed + retardoDed + loanDedThisWeek;
      const netSalary = Math.max(0, grossSalary - totalDeduc);

      // VALIDATION
      let valStatus = "ok";
      let valNote = null;
      if (empAtts.length === 0) {
        valStatus = "sin_datos_asistencia";
        valNote = "Sin registros de asistencia en la semana";
      } else if (daysWorked > 7) {
        valStatus = "revisar";
        valNote = "Días trabajados fuera de rango semanal";
      }

      // Upsert payroll_record 
      const [existingRec] = await sql`
        SELECT * FROM payroll_records 
        WHERE payroll_period_id = ${periodId} AND employee_id = ${emp.employee_id}
        LIMIT 1
      `;

      let recordId;
      if (existingRec) {
        await sql`
          UPDATE payroll_records 
          SET 
            days_worked = ${daysWorked},
            hours_worked = ${hrsWorked},
            base_salary = ${baseCalc},
            bonuses = ${perfectBonus + otherBonuses},
            deductions = ${totalDeduc},
            net_salary = ${netSalary},
            notes = ${valNote || 'Desde asistencia automática + préstamos'},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingRec.id}
        `;
        recordId = existingRec.id;
      } else {
        const [newRec] = await sql`
          INSERT INTO payroll_records (
            payroll_period_id, employee_id, employee_name, department,
            days_worked, hours_worked, base_salary, bonuses, deductions, net_salary, notes
          )
          VALUES (
            ${periodId}, ${emp.employee_id}, ${emp.employee_name}, ${emp.department || null},
            ${daysWorked}, ${hrsWorked}, ${baseCalc}, ${perfectBonus + otherBonuses}, ${totalDeduc}, ${netSalary},
            ${valNote || 'Calculado automáticamente desde asistencia + préstamos/adelantos'}
          )
          RETURNING id
        `;
        recordId = newRec.id;
      }

      // Loan deductions are computed for draft/net salary snapshot only.
      // Actual recording of employee_loan_payments + remaining_balance reduction happens exactly once at payroll APPROVE (idempotent by period+loan+week).

      // SAVE NEW MODEL: payroll_attendance_calculations (trace) - include unified loan deductions
      // Safe upsert (no constraint dependency)
      await sql`DELETE FROM payroll_attendance_calculations WHERE payroll_period_id = ${periodId} AND employee_id = ${emp.employee_id}`;
      await sql`
        INSERT INTO payroll_attendance_calculations (
          payroll_period_id, employee_id, employee_name,
          days_present, days_retardo, absences, days_justified,
          total_late_minutes, overtime_hours, total_hours_worked,
          base_salary_calculated, inasistencia_deduction, perfect_attendance_bonus,
          other_bonuses, total_deductions, calculated_net_salary,
          source_attendance_ids, validation_status, validation_notes
        ) VALUES (
          ${periodId}, ${emp.employee_id}, ${emp.employee_name},
          ${daysPresent}, ${daysRetardo}, ${absences}, ${daysJustified},
          ${lateTotal}, ${overtime}, ${hrsWorked},
          ${baseCalc}, ${absenceDed}, ${perfectBonus},
          ${otherBonuses}, ${totalDeduc}, ${netSalary},
          ${JSON.stringify(attIds || [])}, ${valStatus}, ${valNote || ('incluye ' + empLoans.length + ' préstamos/adelantos')}
        )
      `;

      grandTotal += netSalary;
      empCount++;
      calculations.push({
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        days_worked: daysWorked,
        absences,
        retardos: daysRetardo,
        overtime: overtime.toFixed(2),
        base: baseCalc,
        inasistencia_deduction: absenceDed,
        perfect_bonus: perfectBonus,
        other_bonuses: otherBonuses,
        net: netSalary,
        validation: valStatus
      });
    }

    // Update period totals
    await sql`
      UPDATE payroll_periods 
      SET total_amount = ${grandTotal}, total_employees = ${empCount}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${periodId}
    `;

    return NextResponse.json({
      success: true,
      period_id: periodId,
      total_amount: grandTotal,
      employee_count: empCount,
      calculations,
      message: "Nómina calculada y sincronizada automáticamente con asistencia"
    });
  } catch (error) {
    console.error("Error calculating payroll from attendance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET summary of trace for traceability report: /api/payroll/calculate?period_id=XX
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("period_id");

    if (!periodId) {
      return NextResponse.json({ error: "period_id requerido" }, { status: 400 });
    }

    const traces = await sql`
      SELECT * FROM payroll_attendance_calculations 
      WHERE payroll_period_id = ${parseInt(periodId)}
      ORDER BY employee_name ASC
    `;

    return NextResponse.json(traces);
  } catch (error) {
    console.error("Error fetching trace:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
