import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const concepts = await sql`SELECT * FROM expense_concepts WHERE is_active = true ORDER BY concept_name ASC`;
    return NextResponse.json(concepts);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { concept_name, description = '' } = await request.json();
    if (!concept_name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const [created] = await sql`
      INSERT INTO expense_concepts (concept_name, description) 
      VALUES (${concept_name.trim()}, ${description}) 
      RETURNING *
    `;
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear concepto' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, concept_name, description } = await request.json();
    if (!id || !concept_name) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const [updated] = await sql`
      UPDATE expense_concepts 
      SET concept_name = ${concept_name.trim()}, description = ${description || ''} 
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
    await sql`DELETE FROM expense_concepts WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
