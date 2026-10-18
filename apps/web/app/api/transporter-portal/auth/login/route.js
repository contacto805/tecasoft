import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateTransporterPortalAccess, createTransporterSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { transporterName, pin } = await request.json();
    if (!transporterName || !pin) return NextResponse.json({ success: false, error: "Nombre y PIN requeridos" }, { status: 400 });
    const val = await validateTransporterPortalAccess(transporterName, pin);
    if (!val.ok) return NextResponse.json({ success: false, error: val.error }, { status: 401 });
    await createTransporterSession(transporterName);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
  }
}
