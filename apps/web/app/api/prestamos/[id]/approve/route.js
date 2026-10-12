import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const loanId = parseInt(id);
    
    const [prestamo] = await sql`
      UPDATE employee_loans 
      SET 
        status = 'aprobado',
        approved_at = NOW(),
        approved_by = 'Administración',
        updated_at = NOW()
      WHERE id = ${loanId}
      RETURNING *
    `;

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    // --- LÓGICA PERFECTA DE ENLACE: Generar gasto automático en Módulo de Gastos ---
    // Se crea una sola vez (idempotente) y se almacena la referencia en prestamo_id
    // Se usa expense_type 'payroll_loan' + concept 'Préstamo' + producto descriptivo
    try {
      const existingExp = await sql`
        SELECT id FROM expenses WHERE prestamo_id = ${loanId} LIMIT 1
      `;

      if (existingExp.length === 0) {
        const monto = parseFloat(prestamo.amount || prestamo.monto_original) || 0;
        const fechaGasto = prestamo.fecha_prestamo || new Date().toISOString().split('T')[0];
        const folio = prestamo.folio || `ID-${loanId}`;

        await sql`
          INSERT INTO expenses (
            product_name, 
            cost_per_unit, 
            quantity, 
            total, 
            department, 
            notes, 
            expense_date, 
            expense_type, 
            related_id, 
            concept, 
            prestamo_id
          ) VALUES (
            ${`Préstamo - ${prestamo.employee_name || 'Empleado'} (${folio})`},
            ${monto},
            ${1},
            ${monto},
            ${'Préstamos'},
            ${`Generado automáticamente por aprobación de Préstamo (Módulo Préstamos). Folio: ${folio}. Empleado: ${prestamo.employee_id}. Monto original: ${monto}. Desc. semanal: ${prestamo.descuento_semanal || 0}. Plazo: ${prestamo.num_semanas || prestamo.plazo || 0} sem.`},
            ${fechaGasto},
            ${'payroll_loan'},
            ${prestamo.employee_id && Number.isFinite(parseInt(prestamo.employee_id)) ? parseInt(prestamo.employee_id) : null},
            ${'Préstamo'},
            ${loanId}
          )
          RETURNING id
        `;
      }
    } catch (linkErr) {
      console.error('Error creando el gasto automático enlazado al préstamo:', linkErr);
      // No fallar la aprobación por un error de enlace. El gasto se puede registrar manualmente.
    }

    return NextResponse.json(prestamo);
  } catch (error) {
    console.error('Error approving préstamo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
