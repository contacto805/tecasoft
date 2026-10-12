import { NextResponse } from "next/server";

export async function GET() {
  const isConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  return NextResponse.json({
    configured: isConfigured,
    message: isConfigured
      ? "Servicio de correo electrónico disponible"
      : "Servicio de correo electrónico no configurado. Contacta al administrador."
  });
}
