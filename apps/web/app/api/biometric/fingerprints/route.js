import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener huellas registradas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    let query;

    if (employeeId) {
      query = sql`
        SELECT * FROM employee_fingerprints
        WHERE employee_id = ${employeeId}
        ORDER BY registered_at DESC
      `;
    } else {
      query = sql`
        SELECT * FROM employee_fingerprints
        ORDER BY registered_at DESC
      `;
    }

    const fingerprints = await query;
    return NextResponse.json(fingerprints);
  } catch (error) {
    console.error('Error fetching fingerprints:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar huella de empleado
export async function POST(request) {
  try {
    const { 
      employeeId, 
      employeeName, 
      fingerprintTemplate, 
      fingerPosition, 
      registeredBy 
    } = await request.json();

    if (!employeeId || !employeeName || !fingerprintTemplate) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Verificar si el empleado ya tiene huella registrada para esta posición
    const existing = await sql`
      SELECT * FROM employee_fingerprints
      WHERE employee_id = ${employeeId}
        AND finger_position = ${fingerPosition || 'index_right'}
        AND is_active = true
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'El empleado ya tiene una huella registrada en esta posición' },
        { status: 409 }
      );
    }

    const [fingerprint] = await sql`
      INSERT INTO employee_fingerprints (
        employee_id,
        employee_name,
        fingerprint_template,
        finger_position,
        registered_by,
        registered_at,
        is_active
      )
      VALUES (
        ${employeeId},
        ${employeeName},
        ${fingerprintTemplate},
        ${fingerPosition || 'index_right'},
        ${registeredBy || 'Sistema'},
        CURRENT_TIMESTAMP,
        true
      )
      RETURNING *
    `;

    return NextResponse.json(fingerprint, { status: 201 });
  } catch (error) {
    console.error('Error registering fingerprint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar huella (activar/desactivar)
export async function PUT(request) {
  try {
    const { id, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE employee_fingerprints
      SET is_active = ${isActive !== undefined ? isActive : true}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating fingerprint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar huella
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await sql`DELETE FROM employee_fingerprints WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true, message: 'Huella eliminada' });
  } catch (error) {
    console.error('Error deleting fingerprint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
