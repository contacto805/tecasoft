import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateAndUpdatePortalAccess, createCustomerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { clientNumber, pin } = await request.json();
    if (!clientNumber || !pin) return NextResponse.json({ success: false, error: "Número de cliente y PIN requeridos" }, { status: 400 });

    // Find customer by client_number
    const [cust] = await sql`SELECT id FROM customers WHERE client_number = ${clientNumber} OR customer_name ILIKE ${'%' + clientNumber + '%'} LIMIT 1`;
    if (!cust) return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });

    const val = await validateAndUpdatePortalAccess(cust.id, pin);
    if (!val.ok) return NextResponse.json({ success: false, error: val.error }, { status: 401 });

    await createCustomerSession(cust.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
  }
}
