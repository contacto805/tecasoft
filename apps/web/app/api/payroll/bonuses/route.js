import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: Get bonuses for week or date. ?week_start=YYYY-MM-DD&bonus_type=extra
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let weekStart = searchParams.get("week_start");
    const empId = searchParams.get("employee_id");
    const bonusType = searchParams.get("bonus_type") || "extra";

    if (!weekStart) {
      // fallback: use current date for this week
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const ws = new Date(now.setDate(diff));
      weekStart = ws.toISOString().split("T")[0];
    }

    let query = sql`
      SELECT * FROM payroll_bonuses 
      WHERE week_start_date = ${weekStart}
        AND bonus_type = ${bonusType}
    `;
    if (empId) {
      query = sql`
        SELECT * FROM payroll_bonuses 
        WHERE week_start_date = ${weekStart}
          AND employee_id = ${empId}
          AND bonus_type = ${bonusType}
      `;
    }

    const bonuses = await query;
    return NextResponse.json(bonuses);
  } catch (error) {
    console.error("Error fetching bonuses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create or update extra bonus for an employee for the week
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      employee_id,
      employee_name,
      amount,
      week_start_date,
      week_end_date,
      bonus_type = "extra",
      concept = "Bono Extra",
      authorized_by = "Administración",
      notes = ""
    } = body;

    if (!employee_id || !employee_name || amount === undefined || !week_start_date) {
      return NextResponse.json(
        { error: "Faltan datos requeridos: employee_id, employee_name, amount, week_start_date" },
        { status: 400 }
      );
    }

    const amt = parseFloat(amount) || 0;

    // Check existing record for this emp + week + type
    const [existing] = await sql`
      SELECT * FROM payroll_bonuses 
      WHERE employee_id = ${employee_id} 
        AND week_start_date = ${week_start_date} 
        AND bonus_type = ${bonus_type}
      LIMIT 1
    `;

    let result;
    if (existing) {
      [result] = await sql`
        UPDATE payroll_bonuses
        SET 
          amount = ${amt},
          employee_name = ${employee_name},
          department = ${body.department || existing.department},
          concept = ${concept},
          notes = ${notes || existing.notes},
          authorized_by = ${authorized_by},
          authorized_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
        RETURNING *
      `;
    } else {
      [result] = await sql`
        INSERT INTO payroll_bonuses (
          bonus_type,
          employee_id,
          employee_name,
          department,
          concept,
          amount,
          bonus_date,
          week_start_date,
          week_end_date,
          authorized_by,
          authorized_at,
          status,
          notes
        ) VALUES (
          ${bonus_type},
          ${employee_id},
          ${employee_name},
          ${body.department || null},
          ${concept},
          ${amt},
          ${week_start_date},
          ${week_start_date},
          ${week_end_date || week_start_date},
          ${authorized_by},
          CURRENT_TIMESTAMP,
          'aplicado',
          ${notes}
        )
        RETURNING *
      `;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving bonus:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}