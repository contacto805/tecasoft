import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const units = await sql`
      SELECT * FROM measurement_units
      ORDER BY unit_name ASC
    `;
    return NextResponse.json(units);
  } catch (error) {
    console.error('Error fetching measurement units:', error);
    return NextResponse.json(
      { error: 'Error fetching measurement units' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { unit_name, abbreviation, category } = await request.json();

    if (!unit_name || !unit_name.trim()) {
      return NextResponse.json(
        { error: 'Unit name is required' },
        { status: 400 }
      );
    }

    // Check if unit already exists
    const existing = await sql`
      SELECT id FROM measurement_units WHERE LOWER(unit_name) = LOWER(${unit_name.trim()})
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Esta unidad de medida ya existe' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO measurement_units (unit_name, abbreviation, category)
      VALUES (${unit_name.trim()}, ${abbreviation || null}, ${category || null})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating measurement unit:', error);
    return NextResponse.json(
      { error: 'Error creating measurement unit' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    // Check if unit is used in materials_inventory
    const usageCheck = await sql`
      SELECT COUNT(*) as count FROM materials_inventory WHERE unit = 
      (SELECT unit_name FROM measurement_units WHERE id = ${parseInt(id)})
    `;

    if (usageCheck[0].count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: ${usageCheck[0].count} material(es) usa(n) esta unidad` },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM measurement_units WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting measurement unit:', error);
    return NextResponse.json(
      { error: 'Error deleting measurement unit' },
      { status: 500 }
    );
  }
}
