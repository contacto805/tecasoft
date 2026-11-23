import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPayableBalances, getReceivableBalance } from "@/app/api/utils/financial-balances";

export const dynamic = 'force-dynamic';

function reply(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request) {
  const token = process.env.TECAVO_COORDINATION_TOKEN;
  if (!token || token.length < 32) return reply({ error: 'Integración sin configurar' }, 503);

  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return reply({ error: 'Acceso denegado' }, 401);
  }

  try {
    const [receivable, payable] = await Promise.all([getReceivableBalance(), getPayableBalances()]);
    return reply({
      receivable_usd: receivable,
      payable_mxn: payable.total,
      upcoming_payable_mxn: payable.upcoming_total,
      updated_at: new Date().toISOString()
    });
  } catch {
    return reply({ error: 'Saldos momentáneamente no disponibles' }, 503);
  }
}
