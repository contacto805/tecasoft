import { NextResponse } from "next/server";
import { requireProducerSession } from "@/app/api/utils/customer-portal-auth";
import { findProducerOrder } from "@/app/api/utils/producer-orders";
import { GET as renderContract } from "@/app/api/lots/[lotId]/contract/route";

export async function GET(request) {
  const auth = await requireProducerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const folio = new URL(request.url).searchParams.get("folio");
  if (!folio) return NextResponse.json({ error: "Folio requerido" }, { status: 400 });
  const order = await findProducerOrder(auth.session.producerName, folio);
  if (!order?.lot_id) return NextResponse.json({ error: "Contrato no disponible" }, { status: 404 });
  const response = await renderContract(request, { params: { lotId: order.lot_id } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
