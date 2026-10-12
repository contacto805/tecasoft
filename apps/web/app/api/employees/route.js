import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener empleados
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const isActive = searchParams.get('isActive');
    const department = searchParams.get('department');

    let employees;

    if (employeeId) {
      employees = await sql`
        SELECT * FROM employee_profiles
        WHERE employee_id = ${employeeId}
      `;
    } else if (department) {
      employees = await sql`
        SELECT * FROM employee_profiles
        WHERE department = ${department}
          AND is_active = ${isActive !== 'false'}
        ORDER BY employee_name ASC
      `;
    } else {
      employees = await sql`
        SELECT * FROM employee_profiles
        WHERE is_active = ${isActive !== 'false'}
        ORDER BY employee_name ASC
      `;
    }

    // Optionally attach saldo and loan counts
    if (searchParams.get('withBalances') === 'true') {
      const loans = await sql`
        SELECT 
          employee_id, 
          COALESCE(remaining_balance, amount) as bal, 
          amount,
          status,
          paid_at
        FROM employee_loans
      `;
      
      const loanMap = {};
      loans.forEach(l => {
        const empId = l.employee_id;
        if (!loanMap[empId]) loanMap[empId] = { solicitados: 0, saldo: 0 };
        const balance = parseFloat(l.bal) || parseFloat(l.amount) || 0;
        const isActiveLoan = !l.paid_at && (l.status || '').toLowerCase() !== 'paid' && (l.status || '').toLowerCase() !== 'liquidado';
        if (isActiveLoan) {
          loanMap[empId].solicitados += 1;
          loanMap[empId].saldo += balance;
        }
      });

      employees = employees.map(e => ({
        ...e,
        loan_balance: Math.round((loanMap[e.employee_id]?.saldo || 0) * 100) / 100,
        loan_count: loanMap[e.employee_id]?.solicitados || 0
      }));
    }

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json([]);
  }
}

// POST - Crear empleado
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      employeeId,
      employeeName,
      photoUrl,
      employeeNumber,
      department,
      position,
      hireDate,
      dailySalary,
      weeklySalary,
      hourlyRate,
      paymentType,
      workScheduleStart,
      workScheduleEnd,
      workDays,
      notes
    } = data;

    if (!employeeId || !employeeName) {
      return NextResponse.json(
        { error: 'El ID y nombre del empleado son obligatorios' },
        { status: 400 }
      );
    }

    const [employee] = await sql`
      INSERT INTO employee_profiles (
        employee_id,
        employee_name,
        photo_url,
        employee_number,
        department,
        position,
        hire_date,
        daily_salary,
        weekly_salary,
        hourly_rate,
        payment_type,
        work_schedule_start,
        work_schedule_end,
        work_days,
        notes
      )
      VALUES (
        ${employeeId},
        ${employeeName},
        ${photoUrl || null},
        ${employeeNumber || null},
        ${department || 'Sin Asignar'},
        ${position || 'Sin Asignar'},
        ${hireDate || null},
        ${dailySalary || 0},
        ${weeklySalary || 0},
        ${hourlyRate || 0},
        ${paymentType || 'weekly'},
        ${workScheduleStart || '08:00'},
        ${workScheduleEnd || '17:00'},
        ${JSON.stringify(workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])},
        ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'No fue posible crear el empleado' }, { status: 500 });
  }
}

// PUT - Actualizar empleado
export async function PUT(request) {
  try {
    const data = await request.json();
    const { employeeId, ...updates } = data;

    if (!employeeId) {
      return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
    }

    // Get current record
    const [current] = await sql`
      SELECT * FROM employee_profiles WHERE employee_id = ${employeeId}
    `;

    if (!current) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const [employee] = await sql`
      UPDATE employee_profiles
      SET 
        employee_name = ${updates.employeeName ?? current.employee_name},
        photo_url = ${updates.photoUrl ?? current.photo_url},
        employee_number = ${updates.employeeNumber ?? current.employee_number},
        department = ${updates.department ?? current.department},
        position = ${updates.position ?? current.position},
        hire_date = ${updates.hireDate ?? current.hire_date},
        daily_salary = ${updates.dailySalary ?? current.daily_salary},
        weekly_salary = ${updates.weeklySalary ?? current.weekly_salary},
        hourly_rate = ${updates.hourlyRate ?? current.hourly_rate},
        payment_type = ${updates.paymentType ?? current.payment_type},
        work_schedule_start = ${updates.workScheduleStart ?? current.work_schedule_start},
        work_schedule_end = ${updates.workScheduleEnd ?? current.work_schedule_end},
        work_days = ${(updates.workDays || null) ?? current.work_days},
        is_active = ${updates.isActive !== undefined ? updates.isActive : current.is_active},
        notes = ${updates.notes ?? current.notes},
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ${employeeId}
      RETURNING *
    `;

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'No fue posible actualizar el empleado' }, { status: 500 });
  }
}

// DELETE - Eliminar empleado (borrado lógico)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
    }

    await sql`
      UPDATE employee_profiles
      SET is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ${employeeId}
    `;

    return NextResponse.json({ success: true, message: 'Empleado desactivado exitosamente' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'No fue posible desactivar el empleado' }, { status: 500 });
  }
}
