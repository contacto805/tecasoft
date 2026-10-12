import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener catálogos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const catalog = searchParams.get('catalog');

    if (catalog === 'areas') {
      const areas = await sql`
        SELECT * FROM purchase_order_areas
        WHERE is_active = true
        ORDER BY area_name
      `;
      return NextResponse.json(areas);
    }

    if (catalog === 'categories') {
      const categories = await sql`
        SELECT * FROM purchase_order_categories
        WHERE is_active = true
        ORDER BY category_type, category_name
      `;
      return NextResponse.json(categories);
    }

    if (catalog === 'suppliers') {
      const suppliers = await sql`
        SELECT * FROM purchase_order_suppliers
        WHERE is_active = true
        ORDER BY supplier_name
      `;
      return NextResponse.json(suppliers);
    }

    if (catalog === 'authorization-levels') {
      const levels = await sql`
        SELECT * FROM purchase_authorization_levels
        WHERE is_active = true
        ORDER BY level_order
      `;
      return NextResponse.json(levels);
    }

    // Si no especifica, devolver todos
    const [areas, categories, suppliers, levels] = await Promise.all([
      sql`SELECT * FROM purchase_order_areas WHERE is_active = true ORDER BY area_name`,
      sql`SELECT * FROM purchase_order_categories WHERE is_active = true ORDER BY category_type, category_name`,
      sql`SELECT * FROM purchase_order_suppliers WHERE is_active = true ORDER BY supplier_name`,
      sql`SELECT * FROM purchase_authorization_levels WHERE is_active = true ORDER BY level_order`
    ]);

    return NextResponse.json({
      areas,
      categories,
      suppliers,
      authorizationLevels: levels
    });
  } catch (error) {
    console.error('Error fetching catalogs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear item en catálogo
export async function POST(request) {
  try {
    const { catalog, ...data } = await request.json();

    if (!catalog) {
      return NextResponse.json(
        { error: 'catalog es requerido' },
        { status: 400 }
      );
    }

    let result;

    switch (catalog) {
      case 'areas':
        result = await sql`
          INSERT INTO purchase_order_areas (area_name)
          VALUES (${data.areaName})
          RETURNING *
        `;
        break;

      case 'categories':
        result = await sql`
          INSERT INTO purchase_order_categories (category_name, category_type)
          VALUES (${data.categoryName}, ${data.categoryType})
          RETURNING *
        `;
        break;

      case 'suppliers':
        result = await sql`
          INSERT INTO purchase_order_suppliers (
            supplier_name,
            rfc,
            contact_phone,
            contact_email,
            address
          )
          VALUES (
            ${data.supplierName},
            ${data.rfc || null},
            ${data.contactPhone || null},
            ${data.contactEmail || null},
            ${data.address || null}
          )
          RETURNING *
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Catálogo inválido' },
          { status: 400 }
        );
    }

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating catalog item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar item de catálogo
export async function PUT(request) {
  try {
    const { catalog, id, ...data } = await request.json();

    if (!catalog || !id) {
      return NextResponse.json(
        { error: 'catalog y id son requeridos' },
        { status: 400 }
      );
    }

    let result;

    switch (catalog) {
      case 'areas':
        result = await sql`
          UPDATE purchase_order_areas
          SET 
            area_name = COALESCE(${data.areaName || null}, area_name),
            is_active = COALESCE(${data.isActive !== undefined ? data.isActive : null}, is_active),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        break;

      case 'categories':
        result = await sql`
          UPDATE purchase_order_categories
          SET 
            category_name = COALESCE(${data.categoryName || null}, category_name),
            category_type = COALESCE(${data.categoryType || null}, category_type),
            is_active = COALESCE(${data.isActive !== undefined ? data.isActive : null}, is_active),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        break;

      case 'suppliers':
        result = await sql`
          UPDATE purchase_order_suppliers
          SET 
            supplier_name = COALESCE(${data.supplierName || null}, supplier_name),
            rfc = COALESCE(${data.rfc || null}, rfc),
            contact_phone = COALESCE(${data.contactPhone || null}, contact_phone),
            contact_email = COALESCE(${data.contactEmail || null}, contact_email),
            address = COALESCE(${data.address || null}, address),
            is_active = COALESCE(${data.isActive !== undefined ? data.isActive : null}, is_active),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
          RETURNING *
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Catálogo inválido' },
          { status: 400 }
        );
    }

    if (!result.length) {
      return NextResponse.json(
        { error: 'Item no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating catalog item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
