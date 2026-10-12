import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/app/api/utils/customer-portal-auth";
import { getCustomerLedger } from "@/app/api/utils/customer-account-ledger";

export async function GET() {
  const auth = await requireCustomerSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { customerId } = auth.session;

  try {
    const ledger = await getCustomerLedger(customerId);

    // Quick counts
    const [viajes] = await import("@/app/api/utils/sql").then(m => m.default`
      SELECT COUNT(*) as c FROM viajes WHERE customer_id = ${customerId}
    `);

    return NextResponse.json({
      saldo_por_pagar: ledger.resumen.saldo_por_pagar_usd,
      pagos_realizados: ledger.resumen.total_abonos_usd,
      total_viajes: parseInt(viajes?.c || 0),
      anticipos_disponibles: ledger.resumen.anticipos_disponibles_usd,
      saldo_neto: ledger.resumen.saldo_neto_usd,
      es_saldo_a_favor: ledger.resumen.es_saldo_a_favor,
      actualizado: new Date().toISOString(),
    });
  } catch (e) {
    console.error("client-portal dashboard", e);
    return NextResponse.json({ error: "No pudimos consultar tu información" }, { status: 500 });
  }
}
