import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { validateAndUpdatePortalAccess, createCustomerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST(request) {
  try {
    const { clientNumber, pin } = await request.json();

    if (!clientNumber || !pin) {
      return NextResponse.json({ error: "Número de cliente y PIN requeridos" }, { status: 400 });
    }

    // Find customer by client_number
    const customers = await sql`
      SELECT id, customer_name, client_number FROM customers 
      WHERE client_number = ${clientNumber.trim().toUpperCase()} 
      LIMIT 1
    `;
    if (!customers.length) {
      return NextResponse.json({ error: "Número de cliente no encontrado" }, { status: 404 });
    }
    const customer = customers[0];

    // Validate PIN and access
    const validation = await validateAndUpdatePortalAccess(customer.id, String(pin).trim());
    if (!validation.ok) {
      // Log failed attempt
      await sql`
        INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
        VALUES (${customer.id}, 'LOGIN_FAILED', ${JSON.stringify({ client_number: clientNumber })})
      `;
      return NextResponse.json({ error: validation.error || "Credenciales inválidas" }, { status: 401 });
    }

    // Create session
    await createCustomerSession(customer.id);

    // Audit success
    await sql`
      INSERT INTO customer_portal_audit_log (customer_id, event_type, metadata)
      VALUES (${customer.id}, 'LOGIN_SUCCESS', ${JSON.stringify({ client_number: clientNumber })})
    `;

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.customer_name,
        clientNumber: customer.client_number,
      },
    });
  } catch (e) {
    console.error("client-portal login", e);
    return NextResponse.json({ error: "Error de autenticación" }, { status: 500 });
  }
}
