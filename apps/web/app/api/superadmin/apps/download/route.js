import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Get current authenticated user id (same logic as check-super-admin)
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
      if (sessions.length > 0) {
        userId = sessions[0].userId;
        break;
      }
    } catch (_) {}
    try {
      const decoded = Buffer.from(token, "base64").toString();
      const sd = JSON.parse(decoded);
      if (sd.userId) { userId = sd.userId; break; }
    } catch (_) {}
  }

  if (!userId) return { userId: null, isSuperAdmin: false };

  try {
    const user = await sql`SELECT id, is_super_admin FROM "user" WHERE id = ${userId}`;
    const isSuper = !!(user[0] && user[0].is_super_admin);
    return { userId, isSuperAdmin: isSuper };
  } catch {
    return { userId, isSuperAdmin: false };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId");

    if (!appId) {
      return NextResponse.json({ error: "ID de app requerido" }, { status: 400 });
    }

    const { userId, isSuperAdmin } = await getUserIdAndSuper();

    // Read the app
    const apps = await sql`
      SELECT id, nombre, tipo, apk_url, apk_filename, requiere_autorizacion, estado
      FROM apps_generadas 
      WHERE id = ${parseInt(appId)}
    `;
    if (apps.length === 0) {
      return NextResponse.json({ error: "Aplicación no encontrada" }, { status: 404 });
    }
    const app = apps[0];

    const hasRealUrl = !!app.apk_url;

    // Public apps with NO required authorization
    if (!app.requiere_autorizacion) {
      return NextResponse.json({ 
        allowed: true, 
        download_url: hasRealUrl ? app.apk_url : null,
        use_placeholder: !hasRealUrl,
        filename: app.apk_filename || (app.nombre + '.apk'),
        appName: app.nombre 
      });
    }

    // Need authentication now
    if (!userId) {
      return NextResponse.json({ error: "Necesitas iniciar sesión o solicitar autorización al superadministrador", needLogin: true }, { status: 401 });
    }

    // Super admins always can (show placeholder if no real build yet)
    if (isSuperAdmin) {
      return NextResponse.json({ 
        allowed: true, 
        download_url: hasRealUrl ? app.apk_url : null,
        use_placeholder: !hasRealUrl,
        filename: app.apk_filename || (app.nombre + '.apk'),
        appName: app.nombre 
      });
    }

    // Check explicit
    const auths = await sql`
      SELECT authorized FROM mobile_app_authorizations 
      WHERE app_id = ${parseInt(appId)} AND user_id = ${userId} LIMIT 1
    `;
    const explicit = auths[0]?.authorized === true;

    if (explicit) {
      return NextResponse.json({ 
        allowed: true, 
        download_url: hasRealUrl ? app.apk_url : null,
        use_placeholder: !hasRealUrl,
        filename: app.apk_filename || (app.nombre + '.apk'),
        appName: app.nombre 
      });
    }

    return NextResponse.json({ allowed: false, error: "No tienes autorización para descargar esta APK. Contacta al superadministrador." }, { status: 403 });
  } catch (e) {
    console.error("Download check error", e);
    // Always allow fallback working download on server errors
    return NextResponse.json({ allowed: true, download_url: null, use_placeholder: true, filename: 'app.apk', appName: 'App' });
  }
}

// Support simple POST for immediate redirect download with link in location header etc.
export async function POST(request) {
  try {
    const btxt = await request.text();
    const body = btxt ? JSON.parse(btxt) : {};
    const { appId } = body;

    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/superadmin/apps/download?appId=${appId}`);
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : {};

    if (!data.allowed) {
      return NextResponse.json(data, { status: 403 });
    }

    // Return download link
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo autorizar descarga" }, { status: 500 });
  }
}