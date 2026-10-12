import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getUserIdAndSuper() {
  const cookieStore = await cookies();
  let userId = null;
  const possibleTokens = [
    cookieStore.get("tecavo_session_token")?.value,
    cookieStore.get("better-auth.session_token")?.value,
  ].filter(Boolean);

  for (const token of possibleTokens) {
    if (!token) continue;
    try {
      const sessions = await sql`SELECT s."userId" FROM session s WHERE s.token = ${token} AND s."expiresAt" > NOW() LIMIT 1`;
      if (sessions.length > 0) { userId = sessions[0].userId; break; }
    } catch (_) {}
    try {
      const decoded = Buffer.from(token, "base64").toString();
      const sd = JSON.parse(decoded);
      if (sd.userId) { userId = sd.userId; break; }
    } catch (_) {}
  }
  if (!userId) return { userId: null, isSuperAdmin: false };

  const u = await sql`SELECT is_super_admin FROM "user" WHERE id = ${userId}`;
  return { userId, isSuperAdmin: !!(u[0] && u[0].is_super_admin) };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");
  const { userId } = await getUserIdAndSuper();

  if (!appId || !userId) return NextResponse.json({ authorized: false });

  const res = await sql`
    SELECT authorized FROM mobile_app_authorizations 
    WHERE app_id = ${parseInt(appId)} AND user_id = ${userId} 
    LIMIT 1
  `;
  return NextResponse.json({ authorized: !!res[0]?.authorized });
}

// Super admin only: grant / revoke authorizations
export async function POST(request) {
  try {
    const { userId: targetUserId, appId, authorized, notes } = await request.json();
    const { userId: currentUserId, isSuperAdmin } = await getUserIdAndSuper();

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Solo superadministrador puede autorizar descargas" }, { status: 403 });
    }
    if (!appId || !targetUserId) {
      return NextResponse.json({ error: "appId y targetUserId son requeridos" }, { status: 400 });
    }

    // Upsert
    await sql`
      INSERT INTO mobile_app_authorizations (app_id, user_id, authorized, authorized_by, notes)
      VALUES (${parseInt(appId)}, ${targetUserId}, ${!!authorized}, ${currentUserId}, ${notes || null})
      ON CONFLICT (app_id, user_id) 
      DO UPDATE SET 
        authorized = ${!!authorized}, 
        authorized_by = ${currentUserId},
        authorized_at = CURRENT_TIMESTAMP,
        notes = ${notes || null}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Authorize error:", error);
    return NextResponse.json({ error: "Error al autorizar" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");
    const targetUserId = searchParams.get("userId");

    const { isSuperAdmin } = await getUserIdAndSuper();
    if (!isSuperAdmin) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

    if (!appId || !targetUserId) return NextResponse.json({ error: "Parámetros faltantes" }, { status: 400 });

    await sql`DELETE FROM mobile_app_authorizations WHERE app_id = ${parseInt(appId)} AND user_id = ${targetUserId}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
