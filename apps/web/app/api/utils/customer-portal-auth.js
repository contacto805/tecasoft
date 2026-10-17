import sql from "@/app/api/utils/sql";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "tecavo_client_portal";
const SESSION_DURATION_HOURS = 12;

function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createCustomerSession(customerId) {
  const token = generateSecureToken();
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await sql`
    INSERT INTO customer_portal_sessions (customer_id, token_hash, expires_at)
    VALUES (${customerId}, ${tokenHash}, ${expiresAt})
  `;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  });

  return token;
}

export async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // Fetch candidates (not arbitrary most-recent); match exact token for isolation
  const sessions = await sql`
    SELECT s.*, c.id as customer_id, c.customer_name, c.client_number, c.commercial_name
    FROM customer_portal_sessions s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.expires_at > NOW()
    ORDER BY s.last_activity_at DESC
    LIMIT 100
  `;

  for (const session of sessions) {
    const isValid = await bcrypt.compare(token, session.token_hash);
    if (isValid) {
      await sql`
        UPDATE customer_portal_sessions 
        SET last_activity_at = NOW() 
        WHERE id = ${session.id}
      `;
      return {
        id: session.id,
        customerId: session.customer_id,
        customerName: session.customer_name,
        clientNumber: session.client_number,
        commercialName: session.commercial_name,
        expiresAt: session.expires_at,
      };
    }
  }
  return null;
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "No autorizado", status: 401 };
  }
  return { session };
}

export async function destroyCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    // Revoke ONLY the session matching this exact token (preserve other clients' sessions)
    const candidates = await sql`
      SELECT id, token_hash FROM customer_portal_sessions 
      WHERE expires_at > NOW() 
      LIMIT 100
    `;
    for (const c of candidates) {
      if (await bcrypt.compare(token, c.token_hash)) {
        await sql`DELETE FROM customer_portal_sessions WHERE id = ${c.id}`;
        break;
      }
    }
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function validateAndUpdatePortalAccess(customerId, pin) {
  const rows = await sql`
    SELECT * FROM customer_portal_access 
    WHERE customer_id = ${customerId} AND is_enabled = true
    LIMIT 1
  `;
  if (!rows.length) return { ok: false, error: "Acceso no configurado" };

  const access = rows[0];

  if (access.locked_until && new Date(access.locked_until) > new Date()) {
    return { ok: false, error: "Cuenta bloqueada temporalmente. Intenta más tarde." };
  }

  const isValid = await bcrypt.compare(pin, access.pin_hash);
  if (!isValid) {
    const newAttempts = (access.failed_attempts || 0) + 1;
    let lockedUntil = null;
    if (newAttempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }
    await sql`
      UPDATE customer_portal_access 
      SET failed_attempts = ${newAttempts}, locked_until = ${lockedUntil}, updated_at = NOW()
      WHERE id = ${access.id}
    `;
    return { ok: false, error: "PIN incorrecto" };
  }

  // Success - reset attempts and update login
  await sql`
    UPDATE customer_portal_access 
    SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
    WHERE id = ${access.id}
  `;

  return { ok: true, access };
}

export async function generatePortalPIN(customerId) {
  // Generate 6 digit numeric PIN
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const pinHash = await bcrypt.hash(pin, 10);

  const existing = await sql`
    SELECT id FROM customer_portal_access WHERE customer_id = ${customerId} LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE customer_portal_access 
      SET pin_hash = ${pinHash}, is_enabled = true, failed_attempts = 0, locked_until = NULL, pin_updated_at = NOW(), updated_at = NOW()
      WHERE customer_id = ${customerId}
    `;
  } else {
    await sql`
      INSERT INTO customer_portal_access (customer_id, pin_hash, is_enabled, pin_updated_at)
      VALUES (${customerId}, ${pinHash}, true, NOW())
    `;
  }

  return pin; // Return plain text ONLY once
}

export async function setPortalEnabled(customerId, enabled) {
  await sql`
    UPDATE customer_portal_access 
    SET is_enabled = ${!!enabled}, updated_at = NOW()
    WHERE customer_id = ${customerId}
  `;
}

export async function getPortalAccessStatus(customerId) {
  const rows = await sql`
    SELECT is_enabled, last_login_at, created_at, pin_updated_at, failed_attempts, locked_until
    FROM customer_portal_access 
    WHERE customer_id = ${customerId} 
    LIMIT 1
  `;
  if (!rows.length) return { enabled: false, hasAccess: false };

  const r = rows[0];
  return {
    enabled: !!r.is_enabled,
    hasAccess: true,
    lastLogin: r.last_login_at,
    created: r.created_at,
    pinUpdated: r.pin_updated_at,
    failedAttempts: r.failed_attempts || 0,
    lockedUntil: r.locked_until,
  };
}

// === PRODUCTOR / TRANSPORTISTA (reuse same secure PIN + lock logic, per existing function) ===
const PRODUCER_COOKIE = "tecavo_producer_portal";
const TRANSPORTER_COOKIE = "tecavo_transporter_portal";

export async function createProducerSession(producerName) {
  const token = generateSecureToken();
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  await sql`INSERT INTO producer_portal_sessions (producer_name, token_hash, expires_at) VALUES (${producerName}, ${tokenHash}, ${expiresAt}) ON CONFLICT (producer_name) DO UPDATE SET token_hash=${tokenHash}, expires_at=${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(PRODUCER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DURATION_HOURS * 60 * 60 });
  return token;
}

export async function getProducerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PRODUCER_COOKIE)?.value;
  if (!token) return null;
  // Token-specific match (not arbitrary most-recent)
  const rows = await sql`SELECT * FROM producer_portal_sessions WHERE expires_at > NOW() LIMIT 100`;
  for (const s of rows) {
    const ok = await bcrypt.compare(token, s.token_hash);
    if (ok) {
      await sql`UPDATE producer_portal_sessions SET last_activity_at = NOW() WHERE producer_name = ${s.producer_name}`;
      return { producerName: s.producer_name, expiresAt: s.expires_at };
    }
  }
  return null;
}

export async function requireProducerSession() {
  const s = await getProducerSession();
  if (!s) return { error: "No autorizado", status: 401 };
  return { session: s };
}

export async function validateProducerPortalAccess(identifier, pin) {
  // identifier can be producer_number (preferred) or producer_name for legacy
  const rows = await sql`
    SELECT * FROM producer_portal_access 
    WHERE (producer_number = ${identifier} OR producer_name = ${identifier}) 
    AND is_enabled = true 
    LIMIT 1
  `;
  if (!rows.length) return { ok: false, error: "Acceso no configurado" };
  const a = rows[0];
  if (a.locked_until && new Date(a.locked_until) > new Date()) return { ok: false, error: "Cuenta bloqueada temporalmente" };
  const valid = await bcrypt.compare(String(pin).trim(), a.pin_hash);
  if (!valid) {
    const na = (a.failed_attempts || 0) + 1;
    const lu = na >= 5 ? new Date(Date.now() + 15*60*1000) : null;
    await sql`UPDATE producer_portal_access SET failed_attempts=${na}, locked_until=${lu}, updated_at=NOW() WHERE id=${a.id}`;
    return { ok: false, error: "PIN incorrecto" };
  }
  await sql`UPDATE producer_portal_access SET failed_attempts=0, locked_until=NULL, last_login_at=NOW(), updated_at=NOW() WHERE id=${a.id}`;
  return { ok: true, access: a };
}

export async function generateProducerPIN(producerName, producerNumber = null, whatsappPhone = null) {
  const pin = String(Math.floor(100000 + Math.random()*900000));
  const h = await bcrypt.hash(pin, 10);

  // Use number if provided as immutable login key
  const lookup = producerNumber ? producerNumber : producerName;
  const ex = await sql`
    SELECT id FROM producer_portal_access 
    WHERE (producer_number = ${lookup} OR producer_name = ${producerName}) 
    LIMIT 1
  `;

  if (ex.length) {
    await sql`
      UPDATE producer_portal_access 
      SET pin_hash=${h}, 
          is_enabled=true, 
          failed_attempts=0, 
          locked_until=NULL, 
          pin_updated_at=NOW(), 
          updated_at=NOW(),
          producer_number = COALESCE(producer_number, ${producerNumber}),
          whatsapp_phone = COALESCE(whatsapp_phone, ${whatsappPhone}),
          producer_name = ${producerName}
      WHERE id = ${ex[0].id}
    `;
  } else {
    await sql`
      INSERT INTO producer_portal_access 
      (producer_number, producer_name, pin_hash, is_enabled, pin_updated_at, whatsapp_phone)
      VALUES (${producerNumber || null}, ${producerName}, ${h}, true, NOW(), ${whatsappPhone || null})
    `;
  }
  return pin;
}

export async function sendProducerPINToWhatsApp(identifier, phone, plainPin) {
  // Log attempt always
  try {
    await sql`
      INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
      VALUES (NULL, 'PRODUCER_PIN_WHATSAPP_ATTEMPT', ${JSON.stringify({ identifier, phone: phone ? 'set' : 'missing', ts: new Date().toISOString() })})
    `;
  } catch (_) {}

  if (!phone) {
    return { sent: false, reason: 'no-phone' };
  }

  const whatsappToken = process.env.WHATSAPP_BUSINESS_TOKEN;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

  if (!whatsappToken || !whatsappPhoneId) {
    // Not configured: record failure but do not crash
    try {
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (NULL, 'PRODUCER_PIN_WHATSAPP_NOT_CONFIGURED', ${JSON.stringify({ identifier, phone })})
      `;
    } catch (_) {}
    return { sent: false, reason: 'not-configured' };
  }

  const formatted = String(phone).replace(/[^0-9]/g, '');
  const message = `TECAVO - Tu PIN de acceso al Portal de Productores es: ${plainPin}. Número de productor: ${identifier}. No compartas este PIN.`;

  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatted,
        type: 'text',
        text: { body: message }
      })
    });
    const result = await resp.json().catch(() => ({}));
    const ok = resp.ok && result.messages && result.messages[0];

    await sql`
      INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
      VALUES (NULL, ${ok ? 'PRODUCER_PIN_WHATSAPP_SENT' : 'PRODUCER_PIN_WHATSAPP_FAILED'}, ${JSON.stringify({ identifier, phone: formatted, result: result || {}, status: resp.status })})
    `;
    return { sent: !!ok, result };
  } catch (e) {
    try {
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (NULL, 'PRODUCER_PIN_WHATSAPP_ERROR', ${JSON.stringify({ identifier, error: String(e) })})
      `;
    } catch (_) {}
    return { sent: false, reason: 'error' };
  }
}

// transporter (driver / transportista name as identifier)
export async function createTransporterSession(transporterName) {
  const token = generateSecureToken();
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  await sql`INSERT INTO transporter_portal_sessions (transporter_name, token_hash, expires_at) VALUES (${transporterName}, ${tokenHash}, ${expiresAt}) ON CONFLICT (transporter_name) DO UPDATE SET token_hash=${tokenHash}, expires_at=${expiresAt}`;
  const cookieStore = await cookies();
  cookieStore.set(TRANSPORTER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DURATION_HOURS * 60 * 60 });
  return token;
}

export async function getTransporterSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRANSPORTER_COOKIE)?.value;
  if (!token) return null;
  // Token-specific match (not arbitrary most-recent)
  const rows = await sql`SELECT * FROM transporter_portal_sessions WHERE expires_at > NOW() LIMIT 100`;
  for (const s of rows) {
    const ok = await bcrypt.compare(token, s.token_hash);
    if (ok) {
      await sql`UPDATE transporter_portal_sessions SET last_activity_at = NOW() WHERE transporter_name = ${s.transporter_name}`;
      return { transporterName: s.transporter_name, expiresAt: s.expires_at };
    }
  }
  return null;
}

export async function requireTransporterSession() {
  const s = await getTransporterSession();
  if (!s) return { error: "No autorizado", status: 401 };
  return { session: s };
}

export async function validateTransporterPortalAccess(transporterName, pin) {
  const rows = await sql`SELECT * FROM transporter_portal_access WHERE transporter_name = ${transporterName} AND is_enabled = true LIMIT 1`;
  if (!rows.length) return { ok: false, error: "Acceso no configurado" };
  const a = rows[0];
  if (a.locked_until && new Date(a.locked_until) > new Date()) return { ok: false, error: "Cuenta bloqueada temporalmente" };
  const valid = await bcrypt.compare(String(pin).trim(), a.pin_hash);
  if (!valid) {
    const na = (a.failed_attempts || 0) + 1;
    const lu = na >= 5 ? new Date(Date.now() + 15*60*1000) : null;
    await sql`UPDATE transporter_portal_access SET failed_attempts=${na}, locked_until=${lu}, updated_at=NOW() WHERE id=${a.id}`;
    return { ok: false, error: "PIN incorrecto" };
  }
  await sql`UPDATE transporter_portal_access SET failed_attempts=0, locked_until=NULL, last_login_at=NOW(), updated_at=NOW() WHERE id=${a.id}`;
  return { ok: true };
}

export async function generateTransporterPIN(transporterName) {
  const pin = String(Math.floor(100000 + Math.random()*900000));
  const h = await bcrypt.hash(pin, 10);
  const ex = await sql`SELECT id FROM transporter_portal_access WHERE transporter_name=${transporterName} LIMIT 1`;
  if (ex.length) {
    await sql`UPDATE transporter_portal_access SET pin_hash=${h}, is_enabled=true, failed_attempts=0, locked_until=NULL, pin_updated_at=NOW(), updated_at=NOW() WHERE transporter_name=${transporterName}`;
  } else {
    await sql`INSERT INTO transporter_portal_access (transporter_name, pin_hash, is_enabled, pin_updated_at) VALUES (${transporterName}, ${h}, true, NOW())`;
  }
  return pin;
}
