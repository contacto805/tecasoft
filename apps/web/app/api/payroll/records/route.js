import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('period_id');
    
    if (!periodId) {
      return NextResponse.json(
        { error: 'Se requiere period_id' },
        { status: 400 }
      );
    }

    const records = await sql`
      SELECT * FROM payroll_records
      WHERE payroll_period_id = ${parseInt(periodId)}
      ORDER BY employee_name ASC
    `;

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros de nómina: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      payroll_period_id,
      employee_id,
      employee_name,
      department,
      days_worked,
      hours_worked,
      base_salary,
      bonuses,
      deductions,
      net_salary,
      notes
    } = body;

    if (!payroll_period_id || !employee_name) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO payroll_records (
        payroll_period_id,
        employee_id,
        employee_name,
        department,
        days_worked,
        hours_worked,
        base_salary,
        bonuses,
        deductions,
        net_salary,
        notes
      )
      VALUES (
        ${parseInt(payroll_period_id)},
        ${employee_id || null},
        ${employee_name},
        ${department || null},
        ${days_worked ? parseFloat(days_worked) : null},
        ${hours_worked ? parseFloat(hours_worked) : null},
        ${base_salary ? parseFloat(base_salary) : null},
        ${bonuses ? parseFloat(bonuses) : null},
        ${deductions ? parseFloat(deductions) : null},
        ${net_salary ? parseFloat(net_salary) : null},
        ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating payroll record:', error);
    return NextResponse.json(
      { error: 'Error al crear registro de nómina: ' + error.message },
      { status: 500 }
    );
  }
}
