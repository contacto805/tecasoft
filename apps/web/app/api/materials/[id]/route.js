import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { material_name, category, quantity_available, unit, minimum_stock, reorder_quantity, cost_per_unit, clave, estatus } = await request.json();

    if (!material_name) {
      return NextResponse.json(
        { error: 'Material name is required' },
        { status: 400 }
      );
    }

    const trimmedName = material_name.trim();
    const existing = await sql`
      SELECT id FROM materials_inventory 
      WHERE LOWER(TRIM(material_name)) = LOWER(${trimmedName}) 
      AND id != ${parseInt(id)} 
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un material con ese nombre' },
        { status: 409 }
      );
    }

    const result = await sql`
      UPDATE materials_inventory
      SET material_name = ${trimmedName},
          category = ${category || null},
          quantity_available = ${quantity_available || 0},
          unit = ${unit || 'unidades'},
          minimum_stock = ${minimum_stock || 0},
          reorder_quantity = ${reorder_quantity || 0},
          cost_per_unit = ${cost_per_unit || 0},
          clave = ${clave || null},
          estatus = ${estatus || 'Activo'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json(
      { error: 'Error updating material' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const result = await sql`
      DELETE FROM materials_inventory
      WHERE id = ${parseInt(id)}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json(
      { error: 'Error deleting material' },
      { status: 500 }
    );
  }
}
