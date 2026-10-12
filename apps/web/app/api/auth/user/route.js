import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    
    // Try all known session cookie names. The login-simple now stores a base64(JSON) containing userId and also writes DB row.
    const possibleTokens = [
      cookieStore.get("tecavo_session_token")?.value,
      cookieStore.get("better-auth.session_token")?.value,
    ].filter(Boolean);

    for (const token of possibleTokens) {
      if (!token) continue;

      // 1) Try direct DB session lookup by token (preferred path for PIN login-simple)
      try {
          const sessions = await sql`
          SELECT s."userId", u.id, u.email, u.name, u.image, u.is_super_admin, u.admin_role
          FROM session s
          JOIN "user" u ON s."userId" = u.id
          WHERE s.token = ${token}
            AND s."expiresAt" > NOW()
          LIMIT 1
        `;
          if (sessions.length > 0) {
          const s = sessions[0];
          return NextResponse.json({
            id: s.id || s.userId,
            email: s.email,
            name: s.name,
            image: s.image,
            is_super_admin: !!s.is_super_admin,
            admin_role: s.admin_role || (s.is_super_admin ? 'superadministrador' : 'administrador')
          } || {});
        }
      } catch (e) { /* ignore, fallthrough */ }

      // 2) Fallback: decode the token itself as base64-JSON (what login-simple writes)
      try {
        const decoded = Buffer.from(token, "base64").toString();
        const data = JSON.parse(decoded || '{}');
        const userId = data.userId || data.id;
        if (userId) {
          const users = await sql`
            SELECT id, email, name, image FROM "user" WHERE id = ${userId}
          `;
          if (users.length > 0) {
            // Opportunistically ensure a session row exists so future lookups are fast
            try {
              await sql`
                INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
                VALUES (gen_random_uuid()::text, ${userId}, ${token}, NOW() + INTERVAL '7 days', NOW(), NOW())
                ON CONFLICT (token) DO NOTHING
              `;
            } catch {}
            const u = users[0];
            const fullRes = await sql`SELECT is_super_admin, admin_role FROM "user" WHERE id = ${userId} LIMIT 1`;
            const ur = fullRes[0] || {};
            return NextResponse.json({ ...u, is_super_admin: !!ur.is_super_admin, admin_role: ur.admin_role || 'administrador' });
          }
        }
      } catch (e) {
        // Not JSON or corrupt; continue
      }

      // 3) Legacy split format (id:xxx) if someone used it
      try {
        const decoded = Buffer.from(token, "base64").toString();
        if (decoded.includes(':')) {
          const [userId] = decoded.split(':');
          if (userId) {
            const users = await sql`SELECT id, email, name, image FROM "user" WHERE id = ${userId}`;
            if (users.length) return NextResponse.json(users[0] || {});
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
