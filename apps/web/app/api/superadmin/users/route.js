import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener todos los usuarios con sus permisos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const [user] = await sql`SELECT * FROM "user" WHERE id = ${userId}`;
      
      const permissions = await sql`
        SELECT * FROM user_permissions WHERE user_id = ${userId}
      `;

      return NextResponse.json({ user, permissions });
    }

    const users = await sql`
      SELECT * FROM "user"
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear nuevo usuario
export async function POST(request) {
  try {
    const { name, email, password, is_super_admin, admin_role, modules } = await request.json();

    const roleValue = is_super_admin ? 'superadministrador' : (admin_role || 'administrador');
    const [user] = await sql`
      INSERT INTO "user" (id, name, email, "createdAt", "updatedAt", is_super_admin, admin_role)
      VALUES (gen_random_uuid()::text, ${name}, ${email}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${is_super_admin || false}, ${roleValue})
      RETURNING *
    `;

    if (password) {
      // Full credential provider for PIN login compatibility and validation
      const acctId = crypto.randomUUID();
      await sql`
        INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
        VALUES (${acctId}, ${user.id}, ${email}, 'credential', ${password}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "providerId") DO UPDATE SET password = EXCLUDED.password, "updatedAt" = CURRENT_TIMESTAMP
      `;
    }

    // Asignar permisos si se proporcionan módulos
    if (modules && modules.length > 0) {
      for (const module of modules) {
        await sql`
          INSERT INTO user_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
          VALUES (${user.id}, ${module.module_name}, ${module.can_view}, ${module.can_create}, ${module.can_edit}, ${module.can_delete})
        `;
      }
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar usuario
export async function PUT(request) {
  try {
    const { userId, name, email, is_super_admin, admin_role, password } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const [user] = await sql`
      UPDATE "user"
      SET 
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        is_super_admin = COALESCE(${is_super_admin}, is_super_admin),
        admin_role = COALESCE(${admin_role}, admin_role),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING *
    `;

    if (password) {
      // Update or insert credential PIN row with provider filter
      const upd = await sql`
        UPDATE account 
        SET password = ${password}, "updatedAt" = CURRENT_TIMESTAMP 
        WHERE "userId" = ${userId} AND "providerId" = 'credential'
        RETURNING id
      `;
      if (upd.length === 0 && user && user.email) {
        const aid = crypto.randomUUID();
        const targetEmail = email || user.email;
        await sql`
          INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
          VALUES (${aid}, ${userId}, ${targetEmail}, 'credential', ${password}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }
    }

    // If email changed, sync to the credential accountId
    if (email) {
      try {
        await sql`
          UPDATE account 
          SET "accountId" = ${email} 
          WHERE "userId" = ${userId} AND "providerId" = 'credential'
        `;
      } catch (e) {}
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar usuario
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Eliminar permisos primero (safe)
    try { await sql`DELETE FROM user_permissions WHERE user_id = ${userId}`; } catch(_) {}

    // Eliminar sesiones (safe)
    try { await sql`DELETE FROM session WHERE "userId" = ${userId}`; } catch(_) {}

    // Eliminar cuenta (safe)
    try { await sql`DELETE FROM account WHERE "userId" = ${userId}`; } catch(_) {}

    // Eliminar usuario
    try { await sql`DELETE FROM "user" WHERE id = ${userId}`; } catch (e) { throw e; }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Error al borrar', success: false }, { status: 500 });
  }
}