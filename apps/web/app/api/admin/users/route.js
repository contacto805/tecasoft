import { hash } from "bcryptjs";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// List admin users (for assignments and general admin group)
export async function GET() {
  try {
    const caller = await getVerifiedErpUser();
    if (!caller) return NextResponse.json({error:'Inicia sesión.'},{status:401});
    if (!caller.is_super_admin && caller.admin_role !== 'administrador') return NextResponse.json({error:'Acceso restringido.'},{status:403});
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
    if (!(await getVerifiedErpUser())?.is_super_admin) return NextResponse.json({error:"Acceso exclusivo de Superadministración."},{status:403});
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

    if (!/^(?:\d{4}|\d{6})$/.test(p)) {
      return NextResponse.json(
        { error: "El PIN debe tener 4 o 6 dígitos" },
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

    const roleValue = is_super_admin ? 'superadministrador' : (admin_role || 'administrador');

    // Generate UUID for new user
    const userId = crypto.randomUUID();

    const pinHash=await hash(p,12);
    await sql.transaction([
      sql`INSERT INTO "user"(id,name,email,"emailVerified",is_super_admin,admin_role)
        VALUES(${userId},${n},${e},false,${!!is_super_admin},${roleValue})`,
      sql`INSERT INTO account(id,"userId","accountId","providerId",password)
        VALUES(${crypto.randomUUID()},${userId},${e},'credential',${pinHash})`
    ]);
    return NextResponse.json({success:true,userId,message:"Usuario creado exitosamente"});
  } catch (error) {
    if (error.code==="23505") return NextResponse.json({error:"Ya existe un usuario con ese correo."},{status:409});
    console.error("Error creando usuario",error.message);
    return NextResponse.json({error:"No se pudo crear el usuario."},{status:500});
  }
}
