import { NextResponse } from "next/server";
import { validateProducerPortalAccess, createProducerSession } from "@/app/api/utils/customer-portal-auth";
import { findProducerOrder } from "@/app/api/utils/producer-orders";

export async function POST(request) {
  try {
    const { producerNumber, folio, pin } = await request.json();
    const identifier = String(producerNumber || folio || "").trim();
    if (!identifier || identifier.length > 128 || !/^\d{6}$/.test(String(pin || ""))) {
      return NextResponse.json({ success: false, error: "Número o folio y PIN requeridos" }, { status: 400 });
    }
    const access = await validateProducerPortalAccess(identifier, pin);
    if (!access.ok) return NextResponse.json({ success: false, error: "Número, folio o PIN inválido" }, { status: 401 });
    const order = await findProducerOrder(access.access.producer_name, identifier);
    await createProducerSession(access.access.producer_name);
    return NextResponse.json({ success: true, folio: order?.folio || null });
  } catch (error) {
    console.error("No se pudo iniciar sesión en Productores:", error.message);
    return NextResponse.json({ success: false, error: "Error de autenticación" }, { status: 500 });
  }
}
