import { NextResponse } from "next/server";
import { getCustomerSession } from "@/app/api/utils/customer-portal-auth";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    customer: {
      id: session.customerId,
      name: session.customerName,
      clientNumber: session.clientNumber,
      commercialName: session.commercialName,
    },
  });
}
