import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { id, approved_by } = await request.json();

    const [cost] = await sql`
      UPDATE operating_costs
      SET status = 'aprobado',
          authorized_by = ${approved_by},
          authorized_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Create audit log
    await sql`
      INSERT INTO operating_costs_audit (cost_id, action, user_name, reason)
      VALUES (${id}, 'approved', ${approved_by}, 'Costo aprobado')
    `;

    return NextResponse.json(cost);
  } catch (error) {
    console.error('Error approving cost:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
