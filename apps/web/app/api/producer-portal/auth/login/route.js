import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateProducerPortalAccess, createProducerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { producerNumber, producerName, pin } = await request.json();
    const id = producerNumber || producerName;
    if (!id || !pin) return NextResponse.json({ success: false, error: "Número o folio y PIN requeridos" }, { status: 400 });

    const val = await validateProducerPortalAccess(id, pin);
    if (!val.ok) return NextResponse.json({ success: false, error: val.error }, { status: 401 });

    await createProducerSession(val.access?.producer_name || id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Error de autenticación" }, { status: 500 });
  }
}
