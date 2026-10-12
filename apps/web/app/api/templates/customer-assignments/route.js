import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID requerido' }, { status: 400 });
    }

    const assignments = await sql`
      SELECT 
        a.*,
        t.template_name,
        t.template_code,
        c.category_name
      FROM customer_template_assignments a
      LEFT JOIN label_template_master t ON a.template_id = t.id
      LEFT JOIN template_categories c ON t.category_id = c.id
      WHERE a.customer_id = ${parseInt(customerId)}
      ORDER BY a.template_type
    `;

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Error al obtener asignaciones' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customer_id,
      template_type,
      template_id,
      is_default,
      assigned_by
    } = body;

    // Delete existing assignment for this type
    await sql`
      DELETE FROM customer_template_assignments
      WHERE customer_id = ${customer_id}
      AND template_type = ${template_type}
    `;

    const [newAssignment] = await sql`
      INSERT INTO customer_template_assignments (
        customer_id,
        template_type,
        template_id,
        is_default,
        assigned_by
      ) VALUES (
        ${customer_id},
        ${template_type},
        ${template_id},
        ${is_default || false},
        ${assigned_by}
      )
      RETURNING *
    `;

    return NextResponse.json(newAssignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Error al crear asignación' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`
      DELETE FROM customer_template_assignments
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ error: 'Error al eliminar asignación' }, { status: 500 });
  }
}
