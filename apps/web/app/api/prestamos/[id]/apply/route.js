import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { monto, semana, anno, applied_by = 'Administración', concepto = 'Abono / Pago', fecha } = await request.json();
    
    const loanId = parseInt(id);
    if (!loanId || !monto || monto <= 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Generate automatic folio for abono/pago/movimiento
    const year = new Date().getFullYear();
    const maxp = await sql`SELECT COALESCE(MAX(id), 0) + 1 as nxt FROM employee_loan_payments`;
    const nxt = maxp[0]?.nxt || 1;
    const pfolio = `ABO-PR-${year}-${String(nxt).padStart(4, '0')}`;

    const payFecha = fecha || new Date().toISOString().split('T')[0];

    // Record payment
    const [payment] = await sql`
      INSERT INTO employee_loan_payments 
      (loan_id, monto, fecha, semana, anno, concepto, applied_by, folio)
      VALUES (${loanId}, ${monto}, ${payFecha}, ${semana || null}, ${anno || new Date().getFullYear()}, ${concepto}, ${applied_by}, ${pfolio})
      RETURNING *
    `;

    // Fetch loan to update remaining_balance
    const [loan] = await sql`
      SELECT id, amount, remaining_balance FROM employee_loans WHERE id = ${loanId}
    `;
    if (!loan) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Recompute remaining
    const pays = await sql`
      SELECT COALESCE(SUM(monto), 0) as total_paid FROM employee_loan_payments WHERE loan_id = ${loanId}
    `;
    const paid = parseFloat(pays[0]?.total_paid) || 0;
    const original = parseFloat(loan.amount) || 0;
    const newRemaining = Math.max(0, original - paid);

    const [updated] = await sql`
      UPDATE employee_loans 
      SET remaining_balance = ${newRemaining},
          status = ${newRemaining <= 0 ? 'liquidado' : 'activo'},
          updated_at = NOW(),
          paid_at = ${newRemaining <= 0 ? new Date().toISOString() : null}
      WHERE id = ${loanId}
      RETURNING *
    `;

    return NextResponse.json({ ...updated, last_payment: payment });
  } catch (error) {
    console.error('Error applying discount:', error);
    return NextResponse.json({ error: 'Error al aplicar descuento' }, { status: 500 });
  }
}