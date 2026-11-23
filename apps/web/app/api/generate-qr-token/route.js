import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { ensureLotLink, getPublicLot } from "@/app/api/utils/lot-portal";
import { lotPublicPath, lotPublicUrl } from "@/utils/lot-public-url";

export async function POST(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    const { lot_id } = await request.json();
    if (!/^\d+$/.test(String(lot_id))) return NextResponse.json({ error: "lot_id inválido" }, { status: 400 });
    const link = await ensureLotLink(lot_id);
    if (!link) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    const lot = link.is_active ? await getPublicLot(link.public_token) : null;
    if (!lot) return NextResponse.json({ error: "El enlace del lote está inactivo" }, { status: 409 });
    return NextResponse.json({
      token: lot.public_token,
      url: lotPublicPath(lot.public_token),
      full_url: lotPublicUrl(lot.public_token, new URL(request.url).origin)
    });
  } catch (error) {
    console.error("No se pudo generar el QR:", error.message);
    return NextResponse.json({ error: "No se pudo generar el QR" }, { status: 500 });
  }
}
