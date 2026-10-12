import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Returns a tiny authenticated flag for layout guards and page protections.
// Fully compatible with both the PIN login-simple and possible Better Auth paths.
export async function GET(request) {
  try {
    const cookieStore = await cookies();

    const possibleTokens = [
      cookieStore.get("tecavo_session_token")?.value,
      cookieStore.get("better-auth.session_token")?.value,
    ].filter(Boolean);

    for (const token of possibleTokens) {
      if (!token) continue;

      // DB first (preferred, login-simple now inserts row)
      try {
        const sessions = await sql`
          SELECT s."userId"
          FROM session s
          WHERE s.token = ${token}
            AND s."expiresAt" > NOW()
          LIMIT 1
        `;
        if (sessions.length > 0) {
          return NextResponse.json({ authenticated: true });
        }
      } catch (e) { /* continue */ }

      // Fallback decode the base64 JSON token written by login-simple
      try {
        const decoded = Buffer.from(token, "base64").toString();
        const data = JSON.parse(decoded);
        const userId = data.userId || data.id;
        if (userId) {
          // Quick user existence check
          const checkUser = await sql`SELECT id FROM "user" WHERE id = ${userId} LIMIT 1`;
          if (checkUser.length > 0) {
            return NextResponse.json({ authenticated: true });
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Auth check issue:', error?.message || 'Check failed');
    return NextResponse.json({ authenticated: false });
  }
}
