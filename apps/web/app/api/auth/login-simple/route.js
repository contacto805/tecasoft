import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, pin } = body || {};

    // Validate input
    if (!email || !pin) {
      return NextResponse.json(
        { success: false, error: "Email y PIN son requeridos" },
        { status: 400 }
      );
    }

    // Trim and normalize inputs
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPin = String(pin).toString().trim();

    if (!/^\d{4}$/.test(normalizedPin)) {
      return NextResponse.json(
        { success: false, error: "El PIN debe tener exactamente 4 dígitos" },
        { status: 400 }
      );
    }

    // Query user with PIN from account table (case-insensitive email)
    const result = await sql`
      SELECT u.id, u.email, u.name, u.is_super_admin, u.admin_role, a.password as pin, a."providerId"
      FROM "user" u
      LEFT JOIN account a ON u.id = a."userId" AND a."providerId" = 'credential'
      WHERE LOWER(u.email) = ${normalizedEmail}
      LIMIT 1
    `;

    // Guard: User must exist
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado. Verifica tu correo e intenta de nuevo." },
        { status: 401 }
      );
    }

    const user = result[0];

    // Guard: PIN must exist
    if (!user || !user.pin || String(user.pin).trim() === '') {
      return NextResponse.json(
        { success: false, error: "Este usuario no tiene un PIN configurado" },
        { status: 401 }
      );
    }

    // Normalize stored PIN for comparison (match submitted values exactly after trim)
    const storedPin = String(user.pin).trim();

    // Simple direct PIN comparison (no hashing, just string match)
    const isPinValid = normalizedPin === storedPin;

    // Guard: PIN must match
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "Correo o PIN incorrecto. Por favor verifica tus datos e intenta nuevamente." },
        { status: 401 }
      );
    }

    // Create session token (JSON for simple mode)
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));

    const cookieStore = await cookies();

    // Note: session row is optional. /api/auth/check has fallback decode + user existence
    // Omit DB insert here to avoid runtime errors with differing session schema.

    // Set BOTH cookies 
    cookieStore.set("tecavo_session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    cookieStore.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_super_admin: !!user.is_super_admin,
        admin_role: user.admin_role || (user.is_super_admin ? 'superadministrador' : 'administrador'),
      },
      token: sessionToken,
    }, { status: 200 });
  } catch (error) {
    console.error("Login API error:", error.message);
    return NextResponse.json(
      { success: false, error: "Error del servidor al autenticar. Por favor intenta más tarde." },
      { status: 500 }
    );
  }
}
