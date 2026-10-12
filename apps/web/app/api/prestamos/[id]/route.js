import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const [prestamo] = await sql`
      SELECT * FROM employee_loans 
      WHERE id = ${parseInt(id)}
    `;

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    const payments = await sql`
      SELECT * FROM employee_loan_payments 
      WHERE loan_id = ${parseInt(id)}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ ...prestamo, payments });
  } catch (error) {
    console.error('Error fetching préstamo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const loanId = parseInt(id);
    
    const [updated] = await sql`
      UPDATE employee_loans 
      SET 
        employee_id = ${data.employee_id},
        employee_name = ${data.employee_name},
        type = ${data.type},
        amount = ${data.amount},
        reason = ${data.reason},
        payment_terms = ${data.payment_terms || ''},
        notes = ${data.notes || ''},
        interest_rate = COALESCE(${data.interest_rate || data.tasa_interes || 0}, interest_rate),
        descuento_semanal = COALESCE(${data.descuento_semanal || 0}, descuento_semanal),
        num_semanas = COALESCE(${data.num_semanas || data.plazo || num_semanas}, num_semanas),
        status = COALESCE(${data.status || data.estado || status}, status),
        updated_at = NOW()
      WHERE id = ${loanId}
      RETURNING *
    `;

    // --- Sincronización automática del gasto asociado en Módulo de Gastos ---
    // Si el préstamo está aprobado (o el gasto existe), mantiene el total y descripción en Gastos
    try {
      const linked = await sql`SELECT id FROM expenses WHERE prestamo_id = ${loanId} LIMIT 1`;
      if (linked.length > 0 && updated) {
        const newAmount = parseFloat(updated.amount || updated.monto_original || data.amount) || 0;
        const folio = updated.folio || loanId;
        await sql`
          UPDATE expenses 
          SET 
            total = ${newAmount},
            cost_per_unit = ${newAmount},
            product_name = ${`Préstamo - ${updated.employee_name || data.employee_name} (${folio})`},
            notes = ${`Actualizado automáticamente desde Préstamos. Folio: ${folio}. Empleado: ${updated.employee_id}. Monto: ${newAmount}. Desc semanal: ${updated.descuento_semanal || updated.descuento_semanal || 0}.`},
            expense_date = COALESCE(${updated.fecha_prestamo || data.fecha_prestamo}, expense_date),
            updated_at = NOW()
          WHERE id = ${linked[0].id}
        `;
      }
    } catch (syncErr) {
      console.error('Error sincronizando gasto del préstamo:', syncErr);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating préstamo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    await sql`
      DELETE FROM employee_loans 
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting préstamo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
