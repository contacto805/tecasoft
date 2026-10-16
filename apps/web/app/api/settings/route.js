import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Server-side auth guard for critical config (never expose to browser)
async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tecavo_session_token")?.value || cookieStore.get("better-auth.session_token")?.value;
  if (!token) return { ok: false };
  try {
    const sessions = await sql`SELECT s."userId" FROM session s WHERE s.token = ${token} AND s."expiresAt" > NOW() LIMIT 1`;
    if (sessions.length > 0) return { ok: true, userId: sessions[0].userId };
    const decoded = Buffer.from(token, "base64").toString();
    const data = JSON.parse(decoded);
    if (data.userId) {
      const u = await sql`SELECT id FROM "user" WHERE id = ${data.userId} LIMIT 1`;
      if (u.length) return { ok: true, userId: data.userId };
    }
  } catch (_) {}
  return { ok: false };
}

export async function GET(request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const settings = await sql`SELECT DISTINCT ON (key) key, value FROM system_settings ORDER BY key, id DESC`;
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    const updates = [];
    for (const [key, value] of Object.entries(data)) {
      // Safe upsert using delete+insert inside transaction-like (single statement preferred)
      await sql`
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `;
      updates.push({ key, value });
    }
    
    return NextResponse.json({ success: true, updated: updates });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
