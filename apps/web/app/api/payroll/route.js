import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Return periods so that Nómina page / lists works consistently
    const periods = await sql`
      SELECT pp.*, 
        (SELECT COUNT(*) FROM payroll_records pr WHERE pr.payroll_period_id = pp.id) as record_count
      FROM payroll_periods pp
      ORDER BY pp.week_start_date DESC 
      LIMIT 50
    `;
    return NextResponse.json(periods);
  } catch (error) {
    console.error("Error fetching payroll:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { week_start_date, week_end_date, total_amount, status } = body;

    const folio = `NOM-${(week_start_date || "").replace(/-/g, "")}`;

    const [result] = await sql`
      INSERT INTO payroll_periods (week_start_date, week_end_date, folio, status, total_amount, total_employees)
      VALUES (${week_start_date}, ${week_end_date}, ${folio}, ${status || "pendiente"}, ${total_amount || 0}, 0)
      RETURNING *
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating payroll period:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

