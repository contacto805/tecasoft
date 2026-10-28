import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST - Aprobar nómina y generar gasto automático
export async function POST(request) {
  try {
    const { periodId, approvedBy, paymentStatus = 'pending' } = await request.json();

    if (!periodId || !approvedBy) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // 1. Obtener el período de nómina
    const [period] = await sql`
      SELECT * FROM payroll_periods WHERE id = ${parseInt(periodId)}
    `;

    if (!period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    if (['aprobado', 'pagado'].includes((period.status || '').toLowerCase())) {
      return NextResponse.json(
        { error: 'Esta nómina ya fue aprobada o pagada' },
        { status: 400 }
      );
    }

    // 2. Verificar duplicación en gastos (una sola vez)
    const duplicateCheck = await sql`
      SELECT e.* 
      FROM expenses e
      LEFT JOIN payroll_expense_link pel ON e.id = pel.expense_id
      WHERE e.expense_date BETWEEN ${period.week_start_date} AND ${period.week_end_date}
        AND e.product_name ILIKE '%nómina%'
        AND e.total BETWEEN ${period.total_amount - 1} AND ${period.total_amount + 1}
        AND pel.id IS NULL
    `;

    if (duplicateCheck.length > 0) {
      return NextResponse.json({
        error: 'DUPLICADO_DETECTADO',
        message: 'Existe un gasto similar a esta nómina en el mismo período. Requiere autorización del Superadministrador.',
        duplicates: duplicateCheck,
        requiresSuperAdminApproval: true
      }, { status: 409 });
    }

    // Asegurar que el total esté actualizado desde el snapshot de cálculo (si existe)
    const [traceSum] = await sql`
      SELECT COALESCE(SUM(calculated_net_salary), 0) as snap_total, COUNT(*) as cnt
      FROM payroll_attendance_calculations 
      WHERE payroll_period_id = ${parseInt(periodId)}
    `;
    if (traceSum && parseFloat(traceSum.snap_total) > 0) {
      await sql`UPDATE payroll_periods SET total_amount = ${parseFloat(traceSum.snap_total)}, total_employees = ${parseInt(traceSum.cnt)} WHERE id = ${parseInt(periodId)}`;
      period.total_amount = parseFloat(traceSum.snap_total);
    }

    // 3. Actualizar estado del período a aprobado
    await sql`
      UPDATE payroll_periods
      SET status = 'aprobado',
          approved_by = ${approvedBy},
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(periodId)}
    `;

    // 4. Crear gasto automático en el módulo de gastos
    const expenseDate = period.week_end_date; // Usar el último día de la semana
    const weekLabel = `${new Date(period.week_start_date).toLocaleDateString('es-MX')} - ${new Date(period.week_end_date).toLocaleDateString('es-MX')}`;

    const [expense] = await sql`
      INSERT INTO expenses (
        product_name,
        cost_per_unit,
        quantity,
        total,
        department,
        notes,
        expense_date,
        expense_type,
        related_id
      )
      VALUES (
        ${`Nómina semanal - ${weekLabel}`},
        ${period.total_amount},
        1,
        ${period.total_amount},
        'Nómina',
        ${`Nómina aprobada automáticamente. Folio: ${period.folio}. Empleados: ${period.total_employees}. Aprobado por: ${approvedBy}`},
        ${expenseDate},
        'payroll',
        ${parseInt(periodId)}
      )
      RETURNING *
    `;

    // 5. Crear enlace entre nómina y gasto
    await sql`
      INSERT INTO payroll_expense_link (payroll_period_id, expense_id)
      VALUES (${parseInt(periodId)}, ${expense.id})
    `;

    // 6. Actualizar cierre semanal si existe
    const closings = await sql`
      SELECT id FROM weekly_closings
      WHERE week_start_date = ${period.week_start_date}
        AND week_end_date = ${period.week_end_date}
    `;

    if (closings.length > 0) {
      await sql`
        UPDATE weekly_closings
        SET nomina_semanal = ${period.total_amount},
            total_gastos = COALESCE(total_gastos, 0) + ${period.total_amount},
            total_egresos_dinero = COALESCE(total_egresos_dinero, 0) + ${period.total_amount},
            resultado_dinero = COALESCE(total_ingresos_dinero, 0) - (COALESCE(total_egresos_dinero, 0) + ${period.total_amount}),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${closings[0].id}
      `;
    } else {
      // Crear cierre semanal si no existe
      await sql`
        INSERT INTO weekly_closings (
          week_start_date,
          week_end_date,
          week_label,
          nomina_semanal,
          total_gastos,
          total_egresos_dinero,
          status
        )
        VALUES (
          ${period.week_start_date},
          ${period.week_end_date},
          ${`Semana ${period.week_start_date}`},
          ${period.total_amount},
          ${period.total_amount},
          ${period.total_amount},
          'abierto'
        )
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Nómina aprobada exitosamente',
      expense,
      period: { ...period, status: 'aprobado', approved_by: approvedBy, approved_at: new Date() },
      weeklyClosingUpdated: closings.length > 0
    });
  } catch (error) {
    console.error('Error approving payroll:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST para forzar aprobación con autorización de superadmin
export async function PUT(request) {
  try {
    const { periodId, approvedBy, superAdminOverride = false } = await request.json();

    if (!superAdminOverride) {
      return NextResponse.json(
        { error: 'Esta acción requiere autorización de superadministrador' },
        { status: 403 }
      );
    }

    // Verificar que el usuario es superadmin (esto debería hacerse con el sistema de auth)
    // Por ahora, asumimos que la validación se hizo en el frontend

    // Seguir con el flujo de aprobación normal
    return POST(request);
  } catch (error) {
    console.error('Error in superadmin override:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
