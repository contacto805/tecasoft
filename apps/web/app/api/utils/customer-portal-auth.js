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

  const sessions = await sql`
    SELECT s.*, c.id as customer_id, c.customer_name, c.client_number, c.commercial_name
    FROM customer_portal_sessions s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.expires_at > NOW()
    ORDER BY s.last_activity_at DESC
    LIMIT 1
  `;

  if (!sessions.length) return null;

  const session = sessions[0];

  // Verify token against hash
  const isValid = await bcrypt.compare(token, session.token_hash);
  if (!isValid) return null;

  // Update last activity
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
    // Delete matching session(s)
    await sql`
      DELETE FROM customer_portal_sessions 
      WHERE token_hash IN (
        SELECT token_hash FROM customer_portal_sessions WHERE expires_at > NOW()
      )
    `;
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
