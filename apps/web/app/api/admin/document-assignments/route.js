import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET assignments, optionally filtered by module or output_type
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleCode = searchParams.get("module");
    const outputType = searchParams.get("output_type");

    let where = sql`1=1`;
    if (moduleCode) where = sql`${where} AND module_code = ${moduleCode}`;
    if (outputType) where = sql`${where} AND output_type = ${outputType}`;

    const assignments = await sql`
      SELECT a.*, dt.template_name, dt.document_type, dt.primary_color, dt.font_family, dt.logo_url
      FROM module_document_assignments a
      LEFT JOIN document_templates dt ON a.template_id = dt.id
      WHERE ${where}
      ORDER BY a.module_code, a.output_type
    `;

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: assign or update a template to a module+type
export async function POST(request) {
  try {
    const { module_code, output_type = "pdf", template_id, is_default = true } = await request.json();

    if (!module_code || !template_id) {
      return NextResponse.json({ error: "module_code y template_id son requeridos" }, { status: 400 });
    }

    // Upsert assignment
    const [existing] = await sql`
      SELECT id FROM module_document_assignments 
      WHERE module_code = ${module_code} AND output_type = ${output_type}
    `;

    if (existing) {
      const [updated] = await sql`
        UPDATE module_document_assignments 
        SET template_id = ${template_id}, is_default = ${is_default}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
        RETURNING *
      `;
      return NextResponse.json(updated);
    } else {
      const [created] = await sql`
        INSERT INTO module_document_assignments (module_code, output_type, template_id, is_default)
        VALUES (${module_code}, ${output_type}, ${template_id}, ${is_default})
        RETURNING *
      `;
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error("Error assigning template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE assignment
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const module_code = searchParams.get("module");
    const output_type = searchParams.get("output_type") || "pdf";

    if (!module_code) {
      return NextResponse.json({ error: "module requerido" }, { status: 400 });
    }

    await sql`
      DELETE FROM module_document_assignments 
      WHERE module_code = ${module_code} AND output_type = ${output_type}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
