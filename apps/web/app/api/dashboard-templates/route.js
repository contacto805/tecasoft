import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const id = searchParams.get("id");

    if (id) {
      const template = await sql`
        SELECT * FROM dashboard_templates WHERE id = ${id}
      `;
      return NextResponse.json(template[0] || null);
    }

    let templates;
    if (userId) {
      templates = await sql`
        SELECT * FROM dashboard_templates 
        WHERE user_id = ${userId} OR user_id = 'default'
        ORDER BY created_at DESC
      `;
    } else {
      templates = await sql`
        SELECT * FROM dashboard_templates 
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Error al obtener plantillas" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { templateName, description, templateImageUrl, fieldsConfig, userId } =
      await request.json();

    if (!templateName || !templateImageUrl) {
      return NextResponse.json(
        { error: "Nombre de plantilla e imagen son requeridos" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO dashboard_templates 
      (user_id, template_name, description, template_image_url, fields_config)
      VALUES (${userId || "default"}, ${templateName}, ${description || ""}, ${templateImageUrl}, ${JSON.stringify(fieldsConfig || {})})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Error al crear plantilla" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, templateName, description, templateImageUrl, fieldsConfig, isActive } =
      await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID de plantilla es requerido" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE dashboard_templates
      SET 
        template_name = COALESCE(${templateName}, template_name),
        description = COALESCE(${description}, description),
        template_image_url = COALESCE(${templateImageUrl}, template_image_url),
        fields_config = COALESCE(${fieldsConfig ? JSON.stringify(fieldsConfig) : null}, fields_config),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Error al actualizar plantilla" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de plantilla es requerido" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM dashboard_templates WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Error al eliminar plantilla" },
      { status: 500 }
    );
  }
}
