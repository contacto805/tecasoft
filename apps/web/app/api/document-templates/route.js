import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener todas las plantillas
export async function GET(request) {
  try {
    const templates = await sql`
      SELECT * FROM document_templates 
      WHERE is_active = true 
      ORDER BY document_type ASC, template_name ASC
    `;

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching document templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: crear nueva plantilla
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      template_code, template_name, document_type, description,
      logo_url, primary_color, secondary_color, accent_color,
      font_family, font_size_title, font_size_body, font_size_small,
      page_size, orientation, margin_top, margin_right, margin_bottom, margin_left,
      header_config, footer_config, sections_config, fields_config,
      is_default, created_by
    } = body;

    // Si se marca como predeterminada, desmarcar otras del mismo tipo
    if (is_default) {
      await sql`
        UPDATE document_templates 
        SET is_default = false 
        WHERE document_type = ${document_type}
      `;
    }

    const base_file_url = body.base_file_url || null;
    const [template] = await sql`
      INSERT INTO document_templates (
        template_code, template_name, document_type, description,
        logo_url, base_file_url, primary_color, secondary_color, accent_color,
        font_family, font_size_title, font_size_body, font_size_small,
        page_size, orientation, 
        margin_top, margin_right, margin_bottom, margin_left,
        header_config, footer_config, sections_config, fields_config,
        is_active, is_default, created_by
      ) VALUES (
        ${template_code}, ${template_name}, ${document_type}, ${description || null},
        ${logo_url || null}, ${base_file_url}, ${primary_color || '#024D32'}, ${secondary_color || '#9E4633'}, ${accent_color || '#E8D547'},
        ${font_family || 'Arial'}, ${font_size_title || 18}, ${font_size_body || 12}, ${font_size_small || 10},
        ${page_size || 'A4'}, ${orientation || 'portrait'},
        ${margin_top || 20}, ${margin_right || 20}, ${margin_bottom || 20}, ${margin_left || 20},
        ${header_config ? JSON.stringify(header_config) : null},
        ${footer_config ? JSON.stringify(footer_config) : null},
        ${sections_config ? JSON.stringify(sections_config) : null},
        ${fields_config ? JSON.stringify(fields_config) : null},
        true, ${is_default || false}, ${created_by || null}
      )
      RETURNING *
    `;

    // Crear versión inicial
    await sql`
      INSERT INTO document_template_versions (
        template_id, version_number, change_description, changed_by, new_config
      ) VALUES (
        ${template.id}, 1, 'Creación inicial de plantilla', ${created_by || 'Sistema'},
        ${JSON.stringify(template)}
      )
    `;

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating document template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
