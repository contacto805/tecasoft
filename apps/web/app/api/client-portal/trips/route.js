import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/app/api/utils/customer-portal-auth";
import { getCustomerTrips } from "@/app/api/utils/customer-account-ledger";

export async function GET() {
  const auth = await requireCustomerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const trips = await getCustomerTrips(auth.session.customerId);
    return NextResponse.json(trips);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener viajes" }, { status: 500 });
  }
}
