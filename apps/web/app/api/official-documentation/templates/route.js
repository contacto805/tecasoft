import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: List all templates or get one by ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category");

    if (id) {
      const [template] = await sql`SELECT * FROM official_documentation_templates WHERE id = ${parseInt(id)}`;
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json(template);
    }

    let templates;
    if (category) {
      templates = await sql`SELECT * FROM official_documentation_templates WHERE category = ${category} ORDER BY template_name ASC`;
    } else {
      templates = await sql`SELECT * FROM official_documentation_templates ORDER BY category, template_name ASC`;
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create new template
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      template_code, template_name, document_type, category, description,
      logo_url, primary_color, secondary_color, accent_color,
      font_family, font_size_title, font_size_body, font_size_small,
      page_size, orientation,
      margin_top, margin_right, margin_bottom, margin_left,
      header_config, footer_config, sections_config, fields_config,
      is_active, is_default, created_by
    } = body;

    const [newTemplate] = await sql`
      INSERT INTO official_documentation_templates (
        template_code, template_name, document_type, category, description,
        logo_url, primary_color, secondary_color, accent_color,
        font_family, font_size_title, font_size_body, font_size_small,
        page_size, orientation,
        margin_top, margin_right, margin_bottom, margin_left,
        header_config, footer_config, sections_config, fields_config,
        is_active, is_default, created_by
      ) VALUES (
        ${template_code}, ${template_name}, ${document_type || null}, ${category || null}, ${description || null},
        ${logo_url || null}, ${primary_color || '#024D32'}, ${secondary_color || '#9E4633'}, ${accent_color || '#E8D547'},
        ${font_family || 'Inter, sans-serif'}, ${parseInt(font_size_title) || 24}, ${parseInt(font_size_body) || 12}, ${parseInt(font_size_small) || 10},
        ${page_size || 'letter'}, ${orientation || 'portrait'},
        ${parseInt(margin_top) || 20}, ${parseInt(margin_right) || 20}, ${parseInt(margin_bottom) || 20}, ${parseInt(margin_left) || 20},
        ${JSON.stringify(header_config || {})}, ${JSON.stringify(footer_config || {})}, ${JSON.stringify(sections_config || [])}, ${JSON.stringify(fields_config || {})},
        ${is_active !== false}, ${is_default === true}, ${created_by || 'system'}
      )
      RETURNING *
    `;

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update template
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, changed_by, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    // Get old template for versioning
    const [oldTemplate] = await sql`SELECT * FROM official_documentation_templates WHERE id = ${parseInt(id)}`;
    if (!oldTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    
    if (updates.template_name !== undefined) { updateFields.push('template_name'); values.push(updates.template_name); }
    if (updates.description !== undefined) { updateFields.push('description'); values.push(updates.description); }
    if (updates.logo_url !== undefined) { updateFields.push('logo_url'); values.push(updates.logo_url); }
    if (updates.primary_color !== undefined) { updateFields.push('primary_color'); values.push(updates.primary_color); }
    if (updates.secondary_color !== undefined) { updateFields.push('secondary_color'); values.push(updates.secondary_color); }
    if (updates.accent_color !== undefined) { updateFields.push('accent_color'); values.push(updates.accent_color); }
    if (updates.font_family !== undefined) { updateFields.push('font_family'); values.push(updates.font_family); }
    if (updates.font_size_title !== undefined) { updateFields.push('font_size_title'); values.push(parseInt(updates.font_size_title)); }
    if (updates.font_size_body !== undefined) { updateFields.push('font_size_body'); values.push(parseInt(updates.font_size_body)); }
    if (updates.font_size_small !== undefined) { updateFields.push('font_size_small'); values.push(parseInt(updates.font_size_small)); }
    if (updates.page_size !== undefined) { updateFields.push('page_size'); values.push(updates.page_size); }
    if (updates.orientation !== undefined) { updateFields.push('orientation'); values.push(updates.orientation); }
    if (updates.margin_top !== undefined) { updateFields.push('margin_top'); values.push(parseInt(updates.margin_top)); }
    if (updates.margin_right !== undefined) { updateFields.push('margin_right'); values.push(parseInt(updates.margin_right)); }
    if (updates.margin_bottom !== undefined) { updateFields.push('margin_bottom'); values.push(parseInt(updates.margin_bottom)); }
    if (updates.margin_left !== undefined) { updateFields.push('margin_left'); values.push(parseInt(updates.margin_left)); }
    if (updates.header_config !== undefined) { updateFields.push('header_config'); values.push(JSON.stringify(updates.header_config)); }
    if (updates.footer_config !== undefined) { updateFields.push('footer_config'); values.push(JSON.stringify(updates.footer_config)); }
    if (updates.sections_config !== undefined) { updateFields.push('sections_config'); values.push(JSON.stringify(updates.sections_config)); }
    if (updates.fields_config !== undefined) { updateFields.push('fields_config'); values.push(JSON.stringify(updates.fields_config)); }
    if (updates.is_active !== undefined) { updateFields.push('is_active'); values.push(updates.is_active); }
    if (updates.is_default !== undefined) { updateFields.push('is_default'); values.push(updates.is_default); }

    updateFields.push('updated_at');
    values.push(new Date().toISOString());

    const [updatedTemplate] = await sql`
      UPDATE official_documentation_templates
      SET 
        template_name = ${updates.template_name || oldTemplate.template_name},
        description = ${updates.description !== undefined ? updates.description : oldTemplate.description},
        logo_url = ${updates.logo_url !== undefined ? updates.logo_url : oldTemplate.logo_url},
        primary_color = ${updates.primary_color || oldTemplate.primary_color},
        secondary_color = ${updates.secondary_color || oldTemplate.secondary_color},
        accent_color = ${updates.accent_color || oldTemplate.accent_color},
        font_family = ${updates.font_family || oldTemplate.font_family},
        font_size_title = ${parseInt(updates.font_size_title) || oldTemplate.font_size_title},
        font_size_body = ${parseInt(updates.font_size_body) || oldTemplate.font_size_body},
        font_size_small = ${parseInt(updates.font_size_small) || oldTemplate.font_size_small},
        page_size = ${updates.page_size || oldTemplate.page_size},
        orientation = ${updates.orientation || oldTemplate.orientation},
        margin_top = ${parseInt(updates.margin_top) !== undefined ? parseInt(updates.margin_top) : oldTemplate.margin_top},
        margin_right = ${parseInt(updates.margin_right) !== undefined ? parseInt(updates.margin_right) : oldTemplate.margin_right},
        margin_bottom = ${parseInt(updates.margin_bottom) !== undefined ? parseInt(updates.margin_bottom) : oldTemplate.margin_bottom},
        margin_left = ${parseInt(updates.margin_left) !== undefined ? parseInt(updates.margin_left) : oldTemplate.margin_left},
        header_config = ${updates.header_config ? JSON.stringify(updates.header_config) : oldTemplate.header_config},
        footer_config = ${updates.footer_config ? JSON.stringify(updates.footer_config) : oldTemplate.footer_config},
        sections_config = ${updates.sections_config ? JSON.stringify(updates.sections_config) : oldTemplate.sections_config},
        fields_config = ${updates.fields_config ? JSON.stringify(updates.fields_config) : oldTemplate.fields_config},
        is_active = ${updates.is_active !== undefined ? updates.is_active : oldTemplate.is_active},
        is_default = ${updates.is_default !== undefined ? updates.is_default : oldTemplate.is_default},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Create version history entry
    const versionCount = await sql`SELECT COALESCE(MAX(version_number), 0) as max FROM documentation_template_versions WHERE template_id = ${parseInt(id)}`;
    const nextVersion = (versionCount[0].max || 0) + 1;

    await sql`
      INSERT INTO documentation_template_versions (
        template_id, version_number, change_description, changed_by, changed_at, previous_config, new_config
      ) VALUES (
        ${parseInt(id)}, ${nextVersion}, ${updates.change_description || 'Template updated'}, ${changed_by || 'system'},
        CURRENT_TIMESTAMP, ${JSON.stringify(oldTemplate)}, ${JSON.stringify(updatedTemplate)}
      )
    `;

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete template
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    await sql`DELETE FROM official_documentation_templates WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
