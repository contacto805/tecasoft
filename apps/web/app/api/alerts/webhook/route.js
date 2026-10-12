import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST: genera el JSON exacto del spec para Twilio/Meta WhatsApp y lo loguea
export async function POST(request) {
  try {
    const body = await request.json();
    const { event_type = "security_alert_invoice_cancelled", folio_lote, folio_factura, cliente_id, motivo, superadmin_autorizador = "SUPERADMIN-01", usuario_ejecutor = "USR-CONT-03" } = body;

    // Obtener datos de trazabilidad por ID_Lote (heredados)
    let loteInfo = null;
    let coInfo = null;
    let clienteInfo = { id_cliente: cliente_id || "CLI-000", razon_social: "Cliente Ejemplo" };

    if (folio_lote) {
      const [l] = await sql`SELECT * FROM lots WHERE lot_number = ${folio_lote} OR id = ${parseInt(folio_lote)||0} LIMIT 1`;
      loteInfo = l;
      if (l && l.cutting_order_id) {
        const [co] = await sql`SELECT * FROM cutting_orders WHERE id = ${l.cutting_order_id} LIMIT 1`;
        coInfo = co;
      }
      if (l && l.client_name) {
        const [c] = await sql`SELECT * FROM customers WHERE customer_name ILIKE ${'%' + l.client_name + '%'} LIMIT 1`;
        if (c) clienteInfo = { id_cliente: c.id, razon_social: c.customer_name || c.commercial_name };
      }
    }

    const ts = new Date().toISOString();

    const payload = {
      event_type,
      timestamp: ts,
      security_level: "CRITICAL",
      recipient: {
        role: "Superadministrador",
        whatsapp_channel: "+5210000000000"
      },
      payload: {
        folio_factura: folio_factura || `FAC-${Date.now().toString().slice(-6)}`,
        cliente: clienteInfo,
        comercializacion: {
          calidad_fruta: "Clase A",
          monto_neto: 42500.00,
          divisa: "USD",
          tipo_cambio_aplicado: 19.65
        },
        trazabilidad_origen: {
          folio_lote_centro_costos: loteInfo?.lot_number || folio_lote || "LOTE-0000",
          folio_corte_huerto: coInfo?.folio || "CORTE-0000",
          productor_origen: coInfo?.producer_name || loteInfo?.producer || "Productor Origen"
        },
        auditoria: {
          usuario_ejecutor,
          superadmin_autorizador,
          motivo_cancelacion: motivo || "Rechazo de aduana por exceso de maduración en contenedor marítimo",
          hash_evidencia_digital: "a1b2c3d4e5f6g7h8i9j0"
        }
      }
    };

    // Log interno para auditoría
    await sql`
      INSERT INTO system_alerts (alert_type, priority, module, title, message, entity_type, entity_id, status, created_at)
      VALUES ('webhook_alert', 'CRITICAL', 'seguridad', ${event_type}, ${JSON.stringify(payload)}, 'lote', ${loteInfo ? loteInfo.id : null}, 'pending', CURRENT_TIMESTAMP)
    `;

    return NextResponse.json({ success: true, webhook_payload: payload, message: "JSON listo para envío a WhatsApp/Twilio" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
