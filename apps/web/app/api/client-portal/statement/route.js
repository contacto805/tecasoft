import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/app/api/utils/customer-portal-auth";
import { getCustomerLedger } from "@/app/api/utils/customer-account-ledger";

export async function GET(request) {
  const auth = await requireCustomerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const ledger = await getCustomerLedger(auth.session.customerId, from, to);

    // Log view
    await import("@/app/api/utils/sql").then(m => m.default`
      INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
      VALUES (${auth.session.customerId}, 'STATEMENT_VIEW', ${JSON.stringify({ from, to })})
    `);

    return NextResponse.json({
      ...ledger,
      cliente: {
        nombre: auth.session.customerName,
        numero: auth.session.clientNumber,
      },
      generado: new Date().toISOString(),
    });
  } catch (e) {
    console.error("client-portal statement", e);
    return NextResponse.json({ error: "No pudimos generar el estado de cuenta" }, { status: 500 });
  }
}
