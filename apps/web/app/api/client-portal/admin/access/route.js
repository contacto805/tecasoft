import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { generatePortalPIN, setPortalEnabled, getPortalAccessStatus, createCustomerSession } from "@/app/api/utils/customer-portal-auth";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const wantConfig = searchParams.get("config") === '1';

    if (wantConfig || !customerId) {
      // Return portal config for super or dashboard
      const rows = await sql`
        SELECT setting_value FROM super_admin_settings 
        WHERE setting_key = 'customer_portal_config' 
        LIMIT 1
      `;
      let cfg = {};
      if (rows.length) { try { cfg = JSON.parse(rows[0].setting_value); } catch {} }
      return NextResponse.json({ config: cfg });
    }

    const status = await getPortalAccessStatus(parseInt(customerId));
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { customerId, action } = body;
    if (!customerId || !action) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const cid = parseInt(customerId);

    if (action === "generate-pin") {
      const plainPin = await generatePortalPIN(cid);
      // Audit
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, 'PIN_GENERATED', ${JSON.stringify({ by: "admin" })})
      `;
      return NextResponse.json({ success: true, pin: plainPin });
    }

    if (action === "toggle") {
      const { enabled } = body;
      await setPortalEnabled(cid, enabled);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, ${enabled ? "PORTAL_ENABLED" : "PORTAL_DISABLED"}, ${JSON.stringify({ by: "admin" })})
      `;
      return NextResponse.json({ success: true });
    }

    if (action === "reset-pin") {
      const plainPin = await generatePortalPIN(cid);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, 'PIN_RESET', ${JSON.stringify({ by: "admin" })})
      `;
      return NextResponse.json({ success: true, pin: plainPin });
    }

    if (action === "direct-access" || action === "impersonate") {
      // Superadministrador access without requiring PIN
      await createCustomerSession(cid);
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${cid}, 'SUPERADMIN_DIRECT_ACCESS', ${JSON.stringify({ by: "superadmin", timestamp: new Date().toISOString() })})
      `;
      return NextResponse.json({ success: true });
    }

    // General portal dashboard config (buttons, fields, visibility)
    if (action === "save-portal-config") {
      const { config } = body;
      const existing = await sql`SELECT id FROM super_admin_settings WHERE setting_key = 'customer_portal_config' LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE super_admin_settings SET setting_value = ${JSON.stringify(config)}, updated_at = NOW() WHERE setting_key = 'customer_portal_config'`;
      } else {
        await sql`INSERT INTO super_admin_settings (setting_key, setting_value, setting_category, description) VALUES ('customer_portal_config', ${JSON.stringify(config)}, 'portal', 'Configuración general del portal de clientes (botones, campos, dashboard)')`;
      }
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
