import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const materials = await sql`
      SELECT * FROM materials_inventory
      ORDER BY material_name ASC
    `;
    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json(
      { error: 'Error fetching materials' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
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
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un material con ese nombre' },
        { status: 409 }
      );
    }

    const result = await sql`
      INSERT INTO materials_inventory (material_name, category, quantity_available, unit, minimum_stock, reorder_quantity, cost_per_unit, clave, estatus)
      VALUES (${trimmedName}, ${category || null}, ${quantity_available || 0}, ${unit || 'unidades'}, ${minimum_stock || 0}, ${reorder_quantity || 0}, ${cost_per_unit || 0}, ${clave || null}, ${estatus || 'Activo'})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating material:', error);
    return NextResponse.json(
      { error: 'Error creating material' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, quantity_available, quantity_change } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID required' },
        { status: 400 }
      );
    }

    let updateValue = quantity_available;
    if (quantity_change !== undefined && quantity_available === undefined) {
      // Get current quantity and apply the change
      const current = await sql`SELECT quantity_available FROM materials_inventory WHERE id = ${parseInt(id)}`;
      if (current.length > 0) {
        updateValue = Math.max(0, current[0].quantity_available + quantity_change);
      }
    }

    const result = await sql`
      UPDATE materials_inventory
      SET quantity_available = ${updateValue},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json(
      { error: 'Error updating material' },
      { status: 500 }
    );
  }
}
