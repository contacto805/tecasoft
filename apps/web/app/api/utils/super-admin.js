import sql from "@/app/api/utils/sql";
import { cookies } from "next/headers";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const possibleTokens = [
    cookieStore.get("tecavo_session_token")?.value,
    cookieStore.get("better-auth.session_token")?.value,
  ].filter(Boolean);

  for (const token of possibleTokens) {
    if (!token) continue;
    try {
      const sessions = await sql`
        SELECT s."userId", u.id, u.email, u.name, u.is_super_admin, u.admin_role
        FROM session s
        JOIN "user" u ON s."userId" = u.id
        WHERE s.token = ${token} AND s."expiresAt" > NOW()
        LIMIT 1
      `;
      if (sessions.length) return sessions[0];
    } catch (_) {}
    try {
      const decoded = Buffer.from(token, "base64").toString();
      const data = JSON.parse(decoded);
      const uid = data.userId || data.id;
      if (uid) {
        const [u] = await sql`
          SELECT id, email, name, is_super_admin, admin_role FROM "user" WHERE id = ${uid} LIMIT 1
        `;
        if (u) return u;
      }
    } catch (_) {}
  }
  return null;
}

export async function isSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  return !!(user.is_super_admin || user.admin_role === "superadministrador");
}

export async function requireSuperAdmin() {
  const ok = await isSuperAdmin();
  if (!ok) {
    throw new Error("Solo Superadministrador puede realizar esta acción");
  }
  return true;
}

export function sanitizeForNonSuper(row, isSuper) {
  if (isSuper) return row;
  if (!row) return row;
  const copy = { ...row };
  // Restricted fields for non-supers
  const restricted = [
    "agreed_commission", "agreed_price_per_kg", "show_agreed_price",
    "commission_amount", "fruit_price", "pact_price", "negotiated_price",
    "broker_commission", "margin", "descuento", "condiciones_comerciales",
    "price_per_kg_agreed", "internal_cost", "net_margin"
  ];
  restricted.forEach(k => {
    if (k in copy) copy[k] = null;
  });
  return copy;
}
