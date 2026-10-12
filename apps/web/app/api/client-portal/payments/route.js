import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/app/api/utils/customer-portal-auth";
import { getCustomerPayments } from "@/app/api/utils/customer-account-ledger";

export async function GET() {
  const auth = await requireCustomerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const payments = await getCustomerPayments(auth.session.customerId);
    return NextResponse.json(payments);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}
