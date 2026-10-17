import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateProducerPortalAccess, createProducerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { producerName, pin, folio } = await request.json();
    const identifier = (producerName || '').trim() || (folio || '').trim();
    if (!identifier || !pin) {
      return NextResponse.json({ error: "Productor/PIN requeridos" }, { status: 400 });
    }
    const validation = await validateProducerPortalAccess(identifier, String(pin).trim());
    if (!validation.ok) {
      await sql`INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata) VALUES (NULL, 'PRODUCER_LOGIN_FAILED', ${JSON.stringify({ identifier })})`; // reuse audit table lightly
      return NextResponse.json({ error: validation.error || "Credenciales inválidas" }, { status: 401 });
    }
    await createProducerSession(identifier);
    await sql`INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata) VALUES (NULL, 'PRODUCER_LOGIN_SUCCESS', ${JSON.stringify({ identifier })})` ;
    return NextResponse.json({ success: true, producer: { name: identifier } });
  } catch (e) {
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 });
  }
}
