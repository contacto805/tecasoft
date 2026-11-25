import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import sql from "@/app/api/utils/sql";

export const ERP_PROOF_COOKIE = "tecavo_erp_proof";

function sign(token) {
  const key = process.env.TECAVO_SESSION_SECRET || process.env.BETTER_AUTH_SECRET ||
    process.env.DATABASE_URL;
  return key ? createHmac("sha256", key).update("tecavo:erp-session:").update(token).digest() : null;
}

export function attachErpProof(cookieStore, token, options) {
  const proof = sign(token);
  if (proof) cookieStore.set(ERP_PROOF_COOKIE, proof.toString("hex"), options);
}

export async function getVerifiedErpUser() {
  const jar = await cookies();
  const token = jar.get("tecavo_session_token")?.value;
  const proof = jar.get(ERP_PROOF_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(proof || "")) {
    const expected = sign(token);
    if (expected && timingSafeEqual(expected, Buffer.from(proof, "hex"))) {
      const data = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
      if (data.userId && data.expiresAt > Date.now()) {
        const [user] = await sql`SELECT id, name, email, admin_role, is_super_admin FROM "user" WHERE id = ${data.userId}`;
        if (user) return user;
      }
    }
  }
  const storedToken = jar.get("better-auth.session_token")?.value;
  if (!storedToken) return null;
  try {
    const [user] = await sql`
      SELECT u.id, u.name, u.email, u.admin_role, u.is_super_admin FROM session s JOIN "user" u ON u.id = s."userId"
      WHERE s.token = ${storedToken} AND s."expiresAt" > NOW()
    `;
    return user || null;
  } catch {
    return null;
  }
}
