import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    let userId = null;

    // Simple (PIN) auth session — matches logic from /api/auth/user and login-simple
    const cookieStore = await cookies();
    const possibleTokens = [
      cookieStore.get("tecavo_session_token")?.value,
      cookieStore.get("better-auth.session_token")?.value,
    ].filter(Boolean);

    for (const token of possibleTokens) {
      if (!token) continue;

      // Prefer DB session row (created on every login-simple)
      try {
        const sessions = await sql`
          SELECT s."userId"
          FROM session s
          WHERE s.token = ${token} AND s."expiresAt" > NOW()
          LIMIT 1
        `;
        if (sessions.length > 0) {
          userId = sessions[0].userId;
          break;
        }
      } catch (_) {}

      // Fallback decode base64 JSON from cookie
      try {
        const decoded = Buffer.from(token, "base64").toString();
        const sessionData = JSON.parse(decoded);
        if (sessionData.expiresAt && sessionData.expiresAt > Date.now() && sessionData.userId) {
          userId = sessionData.userId;
          break;
        }
        if (sessionData.userId) {
          userId = sessionData.userId;
          break;
        }
      } catch (_) {}
    }

    // No valid session found
    if (!userId) {
      return NextResponse.json({ isSuperAdmin: false }, { status: 401 });
    }

    // Check if user is super admin
    const user = await sql`
      SELECT id, is_super_admin FROM "user" 
      WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return NextResponse.json({ isSuperAdmin: false }, { status: 404 });
    }

    const adminRole = user[0].admin_role || (user[0].is_super_admin ? 'superadministrador' : 'administrador');
    return NextResponse.json({ 
      isSuperAdmin: user[0].is_super_admin || false,
      adminRole,
      isAdminPrincipal: adminRole === 'administrador_principal',
      userId: user[0].id
    });
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return NextResponse.json({ isSuperAdmin: false }, { status: 500 });
  }
}
