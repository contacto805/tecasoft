import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener permisos de usuario
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const permissions = await sql`
      SELECT * FROM user_permissions WHERE user_id = ${userId} ORDER BY module_name
    `;

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Asignar permisos a usuario
export async function POST(request) {
  try {
    const { userId, moduleName, can_view, can_create, can_edit, can_delete } = await request.json();

    if (!userId || !moduleName) {
      return NextResponse.json({ error: 'userId y moduleName son requeridos' }, { status: 400 });
    }

    // Verificar si ya existe el permiso
    const existing = await sql`
      SELECT id FROM user_permissions WHERE user_id = ${userId} AND module_name = ${moduleName}
    `;

    if (existing.length > 0) {
      // Actualizar
      const [updated] = await sql`
        UPDATE user_permissions
        SET 
          can_view = ${can_view},
          can_create = ${can_create},
          can_edit = ${can_edit},
          can_delete = ${can_delete},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND module_name = ${moduleName}
        RETURNING *
      `;
      return NextResponse.json(updated);
    } else {
      // Crear nuevo
      const [permission] = await sql`
        INSERT INTO user_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
        VALUES (${userId}, ${moduleName}, ${can_view}, ${can_create}, ${can_edit}, ${can_delete})
        RETURNING *
      `;
      return NextResponse.json(permission, { status: 201 });
    }
  } catch (error) {
    console.error('Error setting permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar permiso
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const moduleName = searchParams.get('moduleName');

    if (!userId || !moduleName) {
      return NextResponse.json({ error: 'userId y moduleName son requeridos' }, { status: 400 });
    }

    await sql`
      DELETE FROM user_permissions 
      WHERE user_id = ${userId} AND module_name = ${moduleName}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
