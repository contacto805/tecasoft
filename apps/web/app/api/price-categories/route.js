import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener categorías de precio
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly');

    if (activeOnly === 'true') {
      const categories = await sql`
        SELECT * FROM price_categories
        WHERE is_active = true
        ORDER BY display_order, category_name
      `;
      return NextResponse.json(categories);
    }

    const categories = await sql`
      SELECT * FROM price_categories
      ORDER BY display_order, category_name
    `;
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching price categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear categoría
export async function POST(request) {
  try {
    const body = await request.json();
    const { categoryCode, categoryName, displayOrder, createdBy } = body;

    if (!categoryCode || !categoryName) {
      return NextResponse.json(
        { error: 'Código y nombre son requeridos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO price_categories (
        category_code, category_name, display_order, created_by
      ) VALUES (
        ${categoryCode}, ${categoryName}, ${displayOrder || 0}, ${createdBy || null}
      ) RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating price category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar categoría
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, categoryName, displayOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const [result] = await sql`
      UPDATE price_categories
      SET
        category_name = COALESCE(${categoryName || null}, category_name),
        display_order = COALESCE(${displayOrder !== undefined ? displayOrder : null}, display_order),
        is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating price category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Desactivar categoría (no eliminar)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const [result] = await sql`
      UPDATE price_categories
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deactivating price category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
