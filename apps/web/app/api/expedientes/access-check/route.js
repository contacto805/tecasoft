import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    let userId = null;

    const possible = [
      cookieStore.get("tecavo_session_token")?.value,
      cookieStore.get("better-auth.session_token")?.value
    ].filter(Boolean);

    for (const tok of possible) {
      try {
        const s = await sql`SELECT "userId" FROM session WHERE token = ${tok} AND "expiresAt" > NOW() LIMIT 1`;
        if (s.length) { userId = s[0].userId; break; }
      } catch (_) {}
      try {
        const dec = JSON.parse(Buffer.from(tok, "base64").toString());
        if (dec.userId) { userId = dec.userId; break; }
      } catch(_) {}
    }
    if (!userId) return NextResponse.json({ access: false, role: null });

    const [u] = await sql`SELECT id, is_super_admin FROM "user" WHERE id = ${userId}`;
    if (!u) return NextResponse.json({ access: false, role: null });

    const isSuper = !!u.is_super_admin;

    // Check module-specific permissions for "Encargado de Administración"
    const perms = await sql`
      SELECT * FROM user_permissions 
      WHERE user_id = ${userId} AND module_name = 'expedientes' AND can_view = true
    `;
    const hasPerm = perms.length > 0;

    return NextResponse.json({
      access: isSuper || hasPerm,
      role: isSuper ? 'superadministrador' : (hasPerm ? 'encargado_administracion' : null)
    });
  } catch (e) {
    return NextResponse.json({ access: false });
  }
}
