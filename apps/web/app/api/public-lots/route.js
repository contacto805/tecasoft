import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { ensureLotLink, getPublicLot, getLotPresentation, recordLotScan } from "@/app/api/utils/lot-portal";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";

export async function POST(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    const { lot_id } = await request.json();
    if (!/^\d+$/.test(String(lot_id))) return NextResponse.json({ error: "lot_id inválido" }, { status: 400 });
    const link = await ensureLotLink(lot_id);
    return link ? NextResponse.json(link) : NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  } catch (error) {
    console.error("No se pudo preparar el enlace del lote:", error.message);
    return NextResponse.json({ error: "No se pudo preparar el enlace" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (token !== null) {
      const lot = await getPublicLot(token);
      if (!lot) return NextResponse.json({ error: "Enlace no encontrado o inactivo" }, { status: 404 });
      const { lot: presentation, config } = await getLotPresentation(lot);
      await recordLotScan(request, lot, token);
      const { lot_id, public_token, ...visibleLot } = presentation;
      return NextResponse.json({ lot: visibleLot, token: public_token, config },
        { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }

    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    const links = await sql`
      SELECT l.id AS lot_id, COALESCE(p.public_token, d.public_token) AS public_token
      FROM lots l
      LEFT JOIN lot_dashboard_info d ON d.lot_id = l.id
      LEFT JOIN LATERAL (
        SELECT public_token FROM public_lot_links
        WHERE lot_id = l.id AND is_active = true ORDER BY id LIMIT 1
      ) p ON true
      WHERE d.is_active IS DISTINCT FROM false AND COALESCE(p.public_token, d.public_token) IS NOT NULL
    `;
    return NextResponse.json(links);
  } catch (error) {
    console.error("No se pudo consultar el lote:", error.message);
    return NextResponse.json({ error: "No se pudo consultar el lote" }, { status: 500 });
  }
}
