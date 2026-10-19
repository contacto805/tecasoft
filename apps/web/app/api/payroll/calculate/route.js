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

    // 1. Fetch employees
    const employees = await sql`SELECT * FROM employee_profiles WHERE is_active = true ORDER BY employee_name ASC`;

    // 2. Fetch all attendance in range
    const attendances = await sql`
      SELECT * FROM attendance_records 
      WHERE date BETWEEN ${week_start_date} AND ${week_end_date}
      ORDER BY employee_id, date ASC
    `;

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

      // Penalty for retard (1h like existing): each retardo discounts 1 hour pay equivalent
      const retardoDed = (daysRetardo * (daily / 8));

      // Deduction by absences (full days)
      const absenceDed = absences * daily;

      // Perfect attendance bonus: no faltas + no retardos (and worked at least some days)
      const perfectBonus = (absences === 0 && daysRetardo === 0 && daysWorked >= 1) ? daily : 0;

      // Bonuses from payroll_bonuses table
      const empBonuses = bonuses.filter(b => b.employee_id === emp.employee_id);
      const otherBonuses = empBonuses.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

      // Automatic loan deductions (prestamos/adelantos) for the week - from unified employee_loans source
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

      // Register loan deductions explicitly in payroll_deductions for full traceability (one source)
      for (const ln of empLoans) {
        const wDed = parseFloat(ln.descuento_semanal) || 0;
        if (wDed > 0) {
          await sql`
            INSERT INTO payroll_deductions (
              payroll_period_id, employee_id, employee_name,
              deduction_type, concept, amount, deduction_date,
              week_start_date, week_end_date, authorized_by, status, notes
            ) VALUES (
              ${periodId}, ${emp.employee_id}, ${emp.employee_name},
              'prestamo', ${'Descuento semanal préstamo/adelanto ' + (ln.folio || ln.id)},
              ${wDed}, ${week_start_date},
              ${week_start_date}, ${week_end_date}, 'Sistema (unificado)', 'aplicado',
              ${'Automático desde employee_loans id=' + ln.id + ' remaining=' + (ln.remaining_balance || ln.amount)}
            ) ON CONFLICT DO NOTHING
          `;
        }
      }

      // Apply to loan balances + preserve full payment history (employee_loan_payments)
      // This deducts from total préstamos/adelantos once the weekly payroll is processed
      for (const ln of empLoans) {
        const wDed = parseFloat(ln.descuento_semanal) || 0;
        if (wDed <= 0) continue;

        // Idempotent: do not duplicate payment for same loan in same week
        const already = await sql`
          SELECT id FROM employee_loan_payments 
          WHERE loan_id = ${ln.id} AND fecha BETWEEN ${week_start_date} AND ${week_end_date}
          LIMIT 1
        `;
        if (already.length > 0) continue;

        const pfolio = `ABO-PR-${new Date().getFullYear()}-${String(ln.id).padStart(4,'0')}`;
        await sql`
          INSERT INTO employee_loan_payments (loan_id, monto, fecha, semana, anno, concepto, applied_by, folio)
          VALUES (
            ${ln.id}, ${wDed}, ${week_start_date}, 
            EXTRACT(WEEK FROM ${week_start_date}::date), 
            EXTRACT(YEAR FROM ${week_start_date}::date),
            ${'Descuento semanal por nómina (Asistencia • Préstamos y Adelantos)'},
            'Sistema (pago semanal automático)', ${pfolio}
          )
        `;

        // Recompute remaining and reduce the total in Préstamos y Adelantos
        const paidQ = await sql`SELECT COALESCE(SUM(monto), 0) as total_paid FROM employee_loan_payments WHERE loan_id = ${ln.id}`;
        const paid = parseFloat(paidQ[0]?.total_paid || 0);
        const orig = parseFloat(ln.amount || ln.monto_original || 0);
        const newRemaining = Math.max(0, orig - paid);

        await sql`
          UPDATE employee_loans 
          SET remaining_balance = ${newRemaining},
              status = ${newRemaining <= 0 ? 'liquidado' : 'activo'},
              paid_at = ${newRemaining <= 0 ? new Date().toISOString() : null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${ln.id}
        `;
      }

      // SAVE NEW MODEL: payroll_attendance_calculations (trace) - include unified loan deductions
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
          ${JSON.stringify(attIds)}, ${valStatus}, ${valNote || ('incluye ' + empLoans.length + ' préstamos/adelantos')}
        )
        ON CONFLICT (payroll_period_id, employee_id) DO UPDATE SET
          days_present = EXCLUDED.days_present,
          days_retardo = EXCLUDED.days_retardo,
          absences = EXCLUDED.absences,
          total_late_minutes = EXCLUDED.total_late_minutes,
          overtime_hours = EXCLUDED.overtime_hours,
          total_hours_worked = EXCLUDED.total_hours_worked,
          base_salary_calculated = EXCLUDED.base_salary_calculated,
          inasistencia_deduction = EXCLUDED.inasistencia_deduction,
          perfect_attendance_bonus = EXCLUDED.perfect_attendance_bonus,
          other_bonuses = EXCLUDED.other_bonuses,
          total_deductions = EXCLUDED.total_deductions,
          calculated_net_salary = EXCLUDED.calculated_net_salary,
          source_attendance_ids = EXCLUDED.source_attendance_ids,
          validation_status = EXCLUDED.validation_status,
          validation_notes = EXCLUDED.validation_notes,
          synced_at = CURRENT_TIMESTAMP
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
