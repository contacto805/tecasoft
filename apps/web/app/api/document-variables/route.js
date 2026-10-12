import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener todas las variables disponibles
export async function GET(request) {
  try {
    const variables = await sql`
      SELECT * FROM document_variables 
      ORDER BY variable_category ASC, variable_name ASC
    `;

    return NextResponse.json(variables);
  } catch (error) {
    console.error("Error fetching document variables:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: crear nueva variable (solo para variables custom)
export async function POST(request) {
  try {
    const body = await request.json();
    const { variable_code, variable_name, variable_category, description, data_source, example_value } = body;

    const [variable] = await sql`
      INSERT INTO document_variables (
        variable_code, variable_name, variable_category, description,
        data_source, example_value, is_system
      ) VALUES (
        ${variable_code}, ${variable_name}, ${variable_category}, ${description || null},
        ${data_source || 'custom'}, ${example_value || null}, false
      )
      RETURNING *
    `;

    return NextResponse.json(variable, { status: 201 });
  } catch (error) {
    console.error("Error creating document variable:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
