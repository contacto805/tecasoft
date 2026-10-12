import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener plantilla específica
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const [template] = await sql`
      SELECT * FROM document_templates WHERE id = ${parseInt(id)}
    `;

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching document template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: actualizar plantilla
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Obtener versión anterior para guardar en historial
    const [previousTemplate] = await sql`
      SELECT * FROM document_templates WHERE id = ${parseInt(id)}
    `;

    if (!previousTemplate) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    // Obtener el último número de versión
    const [latestVersion] = await sql`
      SELECT version_number FROM document_template_versions 
      WHERE template_id = ${parseInt(id)} 
      ORDER BY version_number DESC 
      LIMIT 1
    `;

    const newVersionNumber = (latestVersion?.version_number || 0) + 1;

    // Actualizar plantilla
    const [updatedTemplate] = await sql`
      UPDATE document_templates SET
        template_name = ${body.template_name || previousTemplate.template_name},
        description = ${body.description || previousTemplate.description},
        logo_url = ${body.logo_url || previousTemplate.logo_url},
        base_file_url = ${body.base_file_url !== undefined ? body.base_file_url : previousTemplate.base_file_url},
        primary_color = ${body.primary_color || previousTemplate.primary_color},
        secondary_color = ${body.secondary_color || previousTemplate.secondary_color},
        accent_color = ${body.accent_color || previousTemplate.accent_color},
        font_family = ${body.font_family || previousTemplate.font_family},
        font_size_title = ${body.font_size_title || previousTemplate.font_size_title},
        font_size_body = ${body.font_size_body || previousTemplate.font_size_body},
        font_size_small = ${body.font_size_small || previousTemplate.font_size_small},
        page_size = ${body.page_size || previousTemplate.page_size},
        orientation = ${body.orientation || previousTemplate.orientation},
        header_config = ${body.header_config ? JSON.stringify(body.header_config) : previousTemplate.header_config},
        footer_config = ${body.footer_config ? JSON.stringify(body.footer_config) : previousTemplate.footer_config},
        sections_config = ${body.sections_config ? JSON.stringify(body.sections_config) : previousTemplate.sections_config},
        fields_config = ${body.fields_config ? JSON.stringify(body.fields_config) : previousTemplate.fields_config},
        is_active = ${body.is_active !== undefined ? body.is_active : previousTemplate.is_active},
        is_default = ${body.is_default !== undefined ? body.is_default : previousTemplate.is_default},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Crear nueva versión en el historial
    await sql`
      INSERT INTO document_template_versions (
        template_id, version_number, change_description, changed_by,
        previous_config, new_config
      ) VALUES (
        ${parseInt(id)}, ${newVersionNumber}, ${body.change_description || 'Actualización de plantilla'},
        ${body.changed_by || 'Sistema'}, ${JSON.stringify(previousTemplate)}, ${JSON.stringify(updatedTemplate)}
      )
    `;

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating document template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: eliminar plantilla (soft delete)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    await sql`
      UPDATE document_templates 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
