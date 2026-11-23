import { NextResponse } from "next/server";
import { requireProducerSession } from "@/app/api/utils/customer-portal-auth";
import { findProducerOrder, getProducerOrderDetails, listProducerOrders } from "@/app/api/utils/producer-orders";

export async function GET(request) {
  try {
    const auth = await requireProducerSession();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const name = auth.session.producerName;
    const folio = new URL(request.url).searchParams.get("folio");
    const headers = { "Cache-Control": "no-store" };
    if (!folio) return NextResponse.json({ orders: await listProducerOrders(name) }, { headers });
    const order = await findProducerOrder(name, folio);
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    return NextResponse.json(await getProducerOrderDetails(order), { headers });
  } catch (error) {
    console.error("No se pudo consultar el portal de productores:", error.message);
    return NextResponse.json({ error: "No se pudo consultar el portal" }, { status: 500 });
  }
}
