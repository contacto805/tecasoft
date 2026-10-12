import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const templateType = searchParams.get('templateType');

    let query = sql`
      SELECT 
        t.*,
        c.category_name,
        c.icon as category_icon
      FROM label_template_master t
      LEFT JOIN template_categories c ON t.category_id = c.id
      WHERE 1=1
    `;

    if (categoryId) {
      query = sql`${query} AND t.category_id = ${parseInt(categoryId)}`;
    }

    if (status) {
      query = sql`${query} AND t.status = ${status}`;
    }

    if (templateType) {
      query = sql`${query} AND t.template_type = ${templateType}`;
    }

    const finalQuery = sql`${query} ORDER BY t.created_at DESC`;
    const templates = await finalQuery;

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      template_code,
      template_name,
      category_id,
      template_type,
      description,
      width_mm,
      height_mm,
      orientation,
      design_config,
      variables_used,
      created_by
    } = body;

    const [newTemplate] = await sql`
      INSERT INTO label_template_master (
        template_code,
        template_name,
        category_id,
        template_type,
        description,
        width_mm,
        height_mm,
        orientation,
        design_config,
        variables_used,
        created_by
      ) VALUES (
        ${template_code},
        ${template_name},
        ${category_id},
        ${template_type},
        ${description || ''},
        ${width_mm},
        ${height_mm},
        ${orientation || 'vertical'},
        ${JSON.stringify(design_config || {})},
        ${JSON.stringify(variables_used || [])},
        ${created_by}
      )
      RETURNING *
    `;

    // Create initial version
    await sql`
      INSERT INTO template_versions (
        template_id,
        version_number,
        design_config,
        change_description,
        changed_by,
        is_active
      ) VALUES (
        ${newTemplate.id},
        1,
        ${JSON.stringify(design_config || {})},
        'Versión inicial',
        ${created_by},
        true
      )
    `;

    return NextResponse.json(newTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      template_name,
      category_id,
      template_type,
      description,
      width_mm,
      height_mm,
      orientation,
      design_config,
      variables_used,
      status,
      updated_by,
      change_description
    } = body;

    const [updated] = await sql`
      UPDATE label_template_master
      SET
        template_name = ${template_name},
        category_id = ${category_id},
        template_type = ${template_type},
        description = ${description || ''},
        width_mm = ${width_mm},
        height_mm = ${height_mm},
        orientation = ${orientation},
        design_config = ${JSON.stringify(design_config || {})},
        variables_used = ${JSON.stringify(variables_used || [])},
        status = ${status || 'active'},
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    // Create new version
    await sql`
      UPDATE template_versions
      SET is_active = false
      WHERE template_id = ${id}
    `;

    await sql`
      INSERT INTO template_versions (
        template_id,
        version_number,
        design_config,
        change_description,
        changed_by,
        is_active
      ) VALUES (
        ${id},
        ${updated.version},
        ${JSON.stringify(design_config || {})},
        ${change_description || 'Actualización'},
        ${updated_by},
        true
      )
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`
      UPDATE label_template_master
      SET status = 'inactive'
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 });
  }
}
