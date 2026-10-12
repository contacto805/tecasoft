import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const variables = await sql`
      SELECT * FROM template_variables
      WHERE is_active = true
      ORDER BY variable_name
    `;

    return NextResponse.json(variables);
  } catch (error) {
    console.error('Error fetching variables:', error);
    return NextResponse.json({ error: 'Error al obtener variables' }, { status: 500 });
  }
}
