import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET all periods or one by id
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const [period] = await sql`
        SELECT * FROM payroll_periods WHERE id = ${parseInt(id)}
      `;
      return NextResponse.json(period || null);
    }

    const periods = await sql`
      SELECT * FROM payroll_periods 
      ORDER BY week_start_date DESC 
      LIMIT 50
    `;
    return NextResponse.json(periods);
  } catch (error) {
    console.error("Error fetching periods:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new payroll period
export async function POST(request) {
  try {
    const body = await request.json();
    const { week_start_date, week_end_date, approvedBy } = body;

    if (!week_start_date || !week_end_date) {
      return NextResponse.json({ error: "Fechas de semana requeridas" }, { status: 400 });
    }

    const folio = `NOM-${week_start_date.replace(/-/g, "")}`;

    const [period] = await sql`
      INSERT INTO payroll_periods (week_start_date, week_end_date, folio, status, total_amount, total_employees)
      VALUES (${week_start_date}, ${week_end_date}, ${folio}, 'pendiente', 0, 0)
      RETURNING *
    `;
    return NextResponse.json(period, { status: 201 });
  } catch (error) {
    console.error("Error creating period:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
