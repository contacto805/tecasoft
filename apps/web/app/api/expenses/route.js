import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    let where = sql``;
    const conditions = [];
    if (department && department !== 'Todos') conditions.push(sql`department = ${department}`);
    if (startDate) conditions.push(sql`expense_date >= ${startDate}`);
    if (endDate) conditions.push(sql`expense_date <= ${endDate}`);
    if (status) conditions.push(sql`status = ${status}`);

    if (conditions.length > 0) {
      where = sql`WHERE ${conditions.reduce((acc, cond, i) => i === 0 ? cond : sql`${acc} AND ${cond}`, sql``)}`;
    }

    const expenses = await sql`
      SELECT * FROM expenses 
      ${where}
      ORDER BY expense_date DESC, created_at DESC
    `;

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Error al obtener gastos: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { productName, costPerUnit, quantity, total, department, notes, expenseDate, photoUrl, expenseType, relatedId, documentUrl, concept, bypassDuplicateCheck = false, superAdminAuthorization = false, prestamoId, recordedBy, recipientName } = await request.json();

    if (!productName || !costPerUnit || !quantity || !total || !department) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    const finalExpenseDate = expenseDate || new Date().toISOString().split('T')[0];
    const finalRecordedBy = recordedBy || 'Admin';
    const initialStatus = 'pendiente';

    // Verificar duplicados si es gasto de nómina
    if (!bypassDuplicateCheck && productName.toLowerCase().includes('nómina')) {
      // Obtener inicio y fin de semana
      const date = new Date(finalExpenseDate);
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar para que lunes sea el inicio
      const weekStart = new Date(date.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Buscar nóminas aprobadas en esta semana
      const existingPayrolls = await sql`
        SELECT pp.*, pel.expense_id
        FROM payroll_periods pp
        LEFT JOIN payroll_expense_link pel ON pp.id = pel.payroll_period_id
        WHERE pp.week_start_date = ${weekStartStr}
          AND pp.week_end_date = ${weekEndStr}
          AND pp.status = 'aprobado'
      `;

      // Buscar gastos similares en esta semana
      const similarExpenses = await sql`
        SELECT * FROM expenses
        WHERE expense_date BETWEEN ${weekStartStr} AND ${weekEndStr}
          AND product_name ILIKE '%nómina%'
          AND total BETWEEN ${parseFloat(total) - 1} AND ${parseFloat(total) + 1}
      `;

      if (existingPayrolls.length > 0 || similarExpenses.length > 0) {
        if (!superAdminAuthorization) {
          return NextResponse.json({
            error: 'DUPLICADO_NOMINA_DETECTADO',
            message: 'Ya existe una nómina aprobada o un gasto similar para esta semana con el mismo monto. Se requiere autorización del Superadministrador para continuar.',
            existingPayrolls,
            similarExpenses,
            requiresSuperAdminApproval: true
          }, { status: 409 });
        }
      }
    }

    const result = await sql`
      INSERT INTO expenses (product_name, cost_per_unit, quantity, total, department, notes, expense_date, photo_url, expense_type, related_id, document_url, concept, prestamo_id, recorded_by, status, recipient_name, signature_confirmed_by)
      VALUES (${productName}, ${parseFloat(costPerUnit)}, ${parseFloat(quantity)}, ${parseFloat(total)}, ${department}, ${notes || ''}, ${finalExpenseDate}, ${photoUrl || null}, ${expenseType || null}, ${relatedId ? parseInt(relatedId) : null}, ${documentUrl || null}, ${concept || null}, ${prestamoId ? parseInt(prestamoId) : null}, ${finalRecordedBy}, ${initialStatus}, ${recipientName || null}, ${recipientName || null})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Error al crear gasto: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, productName, costPerUnit, quantity, total, department, notes, expenseDate, photoUrl, expenseType, relatedId, documentUrl, concept, prestamoId, action, approvedBy, rejectionReason, recipientName } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de gasto es requerido' },
        { status: 400 }
      );
    }

    // Two-level approval workflow: second general admin approves
    if (action === 'approve' || approvedBy) {
      const approver = approvedBy || 'Admin General';
      const [current] = await sql`SELECT recorded_by, status FROM expenses WHERE id = ${parseInt(id)}`;
      
      if (current && current.recorded_by === approver && current.status === 'pendiente') {
        // Optional: allow only if different, but proceed with note; frontend should enforce different user
      }

      const result = await sql`
        UPDATE expenses
        SET status = 'aprobado',
            approved_by = ${approver},
            approved_at = NOW(),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
      }
      return NextResponse.json(result[0]);
    }

    if (action === 'reject' || rejectionReason) {
      const [result] = await sql`
        UPDATE expenses
        SET status = 'rechazado',
            rejection_reason = ${rejectionReason || 'Rechazado por admin general'},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
      return NextResponse.json(result[0] || { success: false });
    }

    // Regular update
    const result = await sql`
      UPDATE expenses
      SET product_name = ${productName},
          cost_per_unit = ${parseFloat(costPerUnit)},
          quantity = ${parseFloat(quantity)},
          total = ${parseFloat(total)},
          department = ${department},
          notes = ${notes || ''},
          expense_date = ${expenseDate},
          photo_url = ${photoUrl || null},
          expense_type = ${expenseType || null},
          related_id = ${relatedId ? parseInt(relatedId) : null},
          document_url = ${documentUrl || null},
          concept = ${concept || null},
          prestamo_id = COALESCE(${prestamoId ? parseInt(prestamoId) : null}, prestamo_id),
          recipient_name = ${recipientName || null},
          signature_confirmed_by = COALESCE(${recipientName || null}, signature_confirmed_by),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: 'Error al actualizar gasto: ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de gasto es requerido' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM expenses
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Gasto eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Error al eliminar gasto: ' + error.message },
      { status: 500 }
    );
  }
}
