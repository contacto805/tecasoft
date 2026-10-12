import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const [period] = await sql`
      SELECT * FROM payroll_periods
      WHERE id = ${parseInt(id)}
    `;

    if (!period) {
      return NextResponse.json(
        { error: 'Período de nómina no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(period);
  } catch (error) {
    console.error('Error fetching payroll period:', error);
    return NextResponse.json(
      { error: 'Error al obtener período de nómina: ' + error.message },
      { status: 500 }
    );
  }
}
