import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const areas = await sql`SELECT * FROM expense_areas WHERE is_active = true ORDER BY area_name ASC`;
    return NextResponse.json(areas);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener áreas' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { area_name, description = '' } = await request.json();
    if (!area_name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const [created] = await sql`
      INSERT INTO expense_areas (area_name, description) 
      VALUES (${area_name.trim()}, ${description}) 
      RETURNING *
    `;
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear área' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, area_name, description } = await request.json();
    if (!id || !area_name) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const [updated] = await sql`
      UPDATE expense_areas 
      SET area_name = ${area_name.trim()}, description = ${description || ''} 
      WHERE id = ${id} 
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await sql`DELETE FROM expense_areas WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
