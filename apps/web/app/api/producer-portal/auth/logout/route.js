import { NextResponse } from "next/server";
import { destroyProducerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST() {
  try {
    await destroyProducerSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "No se pudo cerrar la sesión" }, { status: 500 });
  }
}
