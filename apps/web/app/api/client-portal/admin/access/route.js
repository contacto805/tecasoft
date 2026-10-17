import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generatePortalPIN, setPortalEnabled, getPortalAccessStatus, createCustomerSession } from "@/app/api/utils/customer-portal-auth";

// Server-side admin check (token-specific, no browser trust)
async function getCurrentAdminUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tecavo_session_token")?.value || cookieStore.get("better-auth.session_token")?.value;
    if (!token) return null;

    const sessions = await sql`
      SELECT s."userId", u.id, u.email, u.name, u.is_super_admin, u.admin_role 
      FROM session s 
      JOIN "user" u ON s."userId" = u.id 
      WHERE s.token = ${token} AND s."expiresAt" > NOW() 
      LIMIT 1
    `;
    if (sessions.length) {
      const s = sessions[0];
      return {
        id: s.id || s.userId,
        name: s.name,
        email: s.email,
        is_super_admin: !!s.is_super_admin,
        admin_role: s.admin_role || (s.is_super_admin ? 'superadministrador' : 'administrador')
      };
    }
    // fallback
    try {
      const decoded = Buffer.from(token, "base64").toString();
      const data = JSON.parse(decoded || '{}');
      const uid = data.userId || data.id;
      if (uid) {
        const [u] = await sql`SELECT id, name, email, is_super_admin, admin_role FROM "user" WHERE id = ${uid} LIMIT 1`;
        if (u) return { id: u.id, name: u.name, email: u.email, is_super_admin: !!u.is_super_admin, admin_role: u.admin_role || (u.is_super_admin ? 'superadministrador' : 'administrador') };
      }
    } catch {}
    return null;
  } catch { return null; }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const wantConfig = searchParams.get("config") === '1';

    if (wantConfig || !customerId) {
      // Config read allowed for portal UI and admin (no sensitive data)
      const rows = await sql`
        SELECT setting_value FROM super_admin_settings 
        WHERE setting_key = 'customer_portal_config' 
        LIMIT 1
      `;
      let cfg = {};
      if (rows.length) { try { cfg = JSON.parse(rows[0].setting_value); } catch {} }
      return NextResponse.json({ config: cfg });
    }

    // Status requires admin auth (customer-specific)
    const currentUser = await getCurrentAdminUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const status = await getPortalAccessStatus(parseInt(customerId));
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const currentUser = await getCurrentAdminUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const isSuper = !!currentUser.is_super_admin || currentUser.admin_role === 'superadministrador';
    const body = await request.json();
    const { customerId, action } = body;
    if (!customerId || !action) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const cid = parseInt(customerId);
    const actor = { id: currentUser.id, name: currentUser.name || currentUser.email };

    if (action === "generate-pin" || action === "reset-pin") {
      if (!isSuper) {
        return NextResponse.json({ error: "Requiere Superadministrador o autorización" }, { status: 403 });
      }
      const plainPin = await generatePortalPIN(cid);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, ${action === 'reset-pin' ? 'PIN_RESET' : 'PIN_GENERATED'}, ${JSON.stringify({ by: actor, timestamp: new Date().toISOString() })})
      `;
      return NextResponse.json({ success: true, pin: plainPin });
    }

    if (action === "toggle") {
      if (!isSuper) {
        return NextResponse.json({ error: "Requiere Superadministrador o autorización" }, { status: 403 });
      }
      const { enabled } = body;
      await setPortalEnabled(cid, enabled);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, ${enabled ? "PORTAL_ENABLED" : "PORTAL_DISABLED"}, ${JSON.stringify({ by: actor, timestamp: new Date().toISOString() })})
      `;
      return NextResponse.json({ success: true });
    }

    if (action === "direct-access" || action === "impersonate") {
      if (!isSuper) {
        return NextResponse.json({ error: "Solo Superadministrador puede acceder directamente al portal de un cliente" }, { status: 403 });
      }
      await createCustomerSession(cid);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, 'SUPERADMIN_DIRECT_ACCESS', ${JSON.stringify({ by: actor, timestamp: new Date().toISOString() })})
      `;
      return NextResponse.json({ success: true });
    }

    if (action === "save-portal-config") {
      if (!isSuper) {
        return NextResponse.json({ error: "Solo Superadministrador puede guardar configuración del portal" }, { status: 403 });
      }
      const { config } = body;
      const existing = await sql`SELECT id FROM super_admin_settings WHERE setting_key = 'customer_portal_config' LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE super_admin_settings SET setting_value = ${JSON.stringify(config)}, updated_at = NOW() WHERE setting_key = 'customer_portal_config'`;
      } else {
        await sql`INSERT INTO super_admin_settings (setting_key, setting_value, setting_category, description) VALUES ('customer_portal_config', ${JSON.stringify(config)}, 'portal', 'Configuración general del portal de clientes (botones, campos, dashboard)')`;
      }
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (NULL, 'PORTAL_CONFIG_SAVED', ${JSON.stringify({ by: actor, timestamp: new Date().toISOString() })})
      `;
      return NextResponse.json({ success: true });
    }

    if (action === "get-portal-config") {
      const rows = await sql`
        SELECT setting_value FROM super_admin_settings 
        WHERE setting_key = 'customer_portal_config' 
        LIMIT 1
      `;
      let cfg = {};
      if (rows.length) {
        try { cfg = JSON.parse(rows[0].setting_value); } catch {}
      }
      return NextResponse.json({ config: cfg });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 });
  }
}
