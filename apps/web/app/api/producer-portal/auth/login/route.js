import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateProducerPortalAccess, createProducerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { producerName, pin, folio, producerNumber } = await request.json();
    // Prefer immutable producer_number as login identifier per spec
    const identifier = (producerNumber || '').trim() || (producerName || '').trim() || (folio || '').trim();
    if (!identifier || !pin) {
      return NextResponse.json({ error: "Productor/PIN requeridos" }, { status: 400 });
    }
    const validation = await validateProducerPortalAccess(identifier, String(pin).trim());
    if (!validation.ok) {
      await sql`INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata) VALUES (NULL, 'PRODUCER_LOGIN_FAILED', ${JSON.stringify({ identifier })})`; 
      return NextResponse.json({ error: validation.error || "Credenciales inválidas" }, { status: 401 });
    }
    await createProducerSession(identifier);
    await sql`INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata) VALUES (NULL, 'PRODUCER_LOGIN_SUCCESS', ${JSON.stringify({ identifier })})` ;
    const accessRecord = validation.access || {};
    return NextResponse.json({ success: true, producer: { name: accessRecord.producer_name || identifier, number: accessRecord.producer_number || null } });
  } catch (e) {
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 });
  }
}
