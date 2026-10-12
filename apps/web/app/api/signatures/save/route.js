import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST - Save signature to respective table
export async function POST(request) {
  try {
    const { 
      signatureUrl, 
      recipientName, 
      transactionType,
      transactionId,
      module
    } = await request.json();

    if (!signatureUrl || !recipientName || !transactionType || !transactionId || !module) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const timestamp = new Date();

    // Update respective table based on module
    if (module === 'prestamo') {
      const [updated] = await sql`
        UPDATE employee_loans
        SET recipient_signature_url = ${signatureUrl},
            signature_captured_at = ${timestamp},
            signature_confirmed_by = ${recipientName}
        WHERE id = ${parseInt(transactionId)}
        RETURNING *
      `;

      if (!updated) {
        return NextResponse.json(
          { error: 'Préstamo no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Firma guardada exitosamente',
        record: updated 
      });
    } 
    else if (module === 'gasto') {
      const [updated] = await sql`
        UPDATE expenses
        SET recipient_signature_url = ${signatureUrl},
            signature_captured_at = ${timestamp},
            signature_confirmed_by = ${recipientName}
        WHERE id = ${parseInt(transactionId)}
        RETURNING *
      `;

      if (!updated) {
        return NextResponse.json(
          { error: 'Gasto no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Firma guardada exitosamente',
        record: updated 
      });
    } 
    else if (module === 'nomina') {
      const [updated] = await sql`
        UPDATE payroll_records
        SET recipient_signature_url = ${signatureUrl},
            signature_captured_at = ${timestamp},
            signature_confirmed_by = ${recipientName}
        WHERE id = ${parseInt(transactionId)}
        RETURNING *
      `;

      if (!updated) {
        return NextResponse.json(
          { error: 'Registro de nómina no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Firma guardada exitosamente',
        record: updated 
      });
    }

    return NextResponse.json(
      { error: 'Módulo no válido' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error saving signature:', error);
    return NextResponse.json(
      { error: 'Error al guardar firma: ' + error.message },
      { status: 500 }
    );
  }
}
