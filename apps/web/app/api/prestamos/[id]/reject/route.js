import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    
    const [prestamo] = await sql`
      UPDATE employee_loans 
      SET 
        status = 'rechazado',
        rejected_at = NOW(),
        rejected_by = 'admin',
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(prestamo);
  } catch (error) {
    console.error('Error rejecting préstamo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
