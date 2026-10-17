import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateTransporterPortalAccess, createTransporterSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { transporterName, pin } = await request.json();
    if (!transporterName || !pin) {
      return NextResponse.json({ error: "Transportista y PIN requeridos" }, { status: 400 });
    }
    const validation = await validateTransporterPortalAccess(transporterName.trim(), String(pin).trim());
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error || "Credenciales inválidas" }, { status: 401 });
    }
    await createTransporterSession(transporterName.trim());
    return NextResponse.json({ success: true, transporter: { name: transporterName.trim() } });
  } catch (e) {
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 });
  }
}
