import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// List admin users (for assignments and general admin group)
export async function GET() {
  try {
    const users = await sql`
      SELECT id, name, email, admin_role, is_super_admin
      FROM "user"
      WHERE (admin_role ILIKE '%admin%' OR admin_role = 'administrador' OR is_super_admin = true)
        AND (admin_role IS NOT NULL OR is_super_admin = true)
      ORDER BY name ASC
    `;
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error listing admin users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create new user
export async function POST(request) {
  try {
    const { name, email, pin, is_super_admin, admin_role } = await request.json();

    const n = String(name || '').trim();
    const e = String(email || '').trim().toLowerCase();
    const p = String(pin || '').trim();

    if (!n || !e || !p) {
      return NextResponse.json(
        { error: "Nombre, email y PIN son requeridos" },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(p)) {
      return NextResponse.json(
        { error: "El PIN debe tener exactamente 4 dígitos" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json(
        { error: "El email no es válido" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM "user" WHERE email = ${e}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    const callerIsSuper = await (async () => {
      // lightweight check
      const { getCurrentUser } = await import('@/app/api/utils/super-admin');
      const u = await getCurrentUser();
      return !!(u && (u.is_super_admin || u.admin_role === 'superadministrador'));
    })();
    if ((!!is_super_admin || (admin_role||'').toLowerCase()==='superadministrador') && !callerIsSuper) {
      return NextResponse.json({ error: 'Solo Superadministrador puede crear usuarios Superadministrador' }, { status: 403 });
    }

    const roleValue = is_super_admin ? 'superadministrador' : (admin_role || 'administrador');

    // Generate UUID for new user
    const userId = crypto.randomUUID();

    // Create user with roles
    await sql`
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", is_super_admin, admin_role)
      VALUES (${userId}, ${n}, ${e}, false, NOW(), NOW(), ${!!is_super_admin}, ${roleValue})
    `;

    // Create account with PIN (always credential provider for PIN login)
    const accountId = crypto.randomUUID();
    await sql`
      INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
      VALUES (${accountId}, ${userId}, ${e}, 'credential', ${p}, NOW(), NOW())
    `;

    return NextResponse.json({
      success: true,
      userId,
      message: "Usuario creado exitosamente"
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}