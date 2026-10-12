import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const { pin } = await request.json();
    if (!pin || !/^\d{4}$/.test(pin.toString().trim())) {
      return NextResponse.json({ success: false, error: "PIN debe tener 4 dígitos" }, { status: 400 });
    }

    const cookieStore = await cookies();
    let userId = null;

    const possibleTokens = [
      cookieStore.get("tecavo_session_token")?.value,
      cookieStore.get("better-auth.session_token")?.value,
    ].filter(Boolean);

    for (const token of possibleTokens) {
      if (!token) continue;
      try {
        const sessions = await sql`
          SELECT s."userId"
          FROM session s
          WHERE s.token = ${token} AND s."expiresAt" > NOW()
          LIMIT 1
        `;
        if (sessions.length > 0) {
          userId = sessions[0].userId;
          break;
        }
      } catch (_) {}
      try {
        const decoded = Buffer.from(token, "base64").toString();
        const sessionData = JSON.parse(decoded);
        if (sessionData.userId) {
          userId = sessionData.userId;
          break;
        }
      } catch (_) {}
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const result = await sql`
      SELECT u.id, a.password as stored_pin
      FROM "user" u
      LEFT JOIN account a ON u.id = a."userId" AND a."providerId" = 'credential'
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const u = result[0];
    if (!u.stored_pin) {
      return NextResponse.json({ success: false, error: "Usuario no tiene PIN configurado" }, { status: 400 });
    }

    const match = pin.toString().trim() === u.stored_pin.toString().trim();

    return NextResponse.json({ success: match, isSuperAdmin: true });
  } catch (err) {
    console.error("verify-pin error", err);
    return NextResponse.json({ success: false, error: "Error servidor" }, { status: 500 });
  }
}
