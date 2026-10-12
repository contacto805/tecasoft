import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener recepciones de material
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const purchaseOrderId = searchParams.get('purchaseOrderId');

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: 'purchaseOrderId es requerido' },
        { status: 400 }
      );
    }

    const receptions = await sql`
      SELECT * FROM purchase_receptions
      WHERE purchase_order_id = ${parseInt(purchaseOrderId)}
      ORDER BY reception_date DESC
    `;

    return NextResponse.json(receptions);
  } catch (error) {
    console.error('Error fetching receptions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar recepción de material
export async function POST(request) {
  try {
    const {
      purchaseOrderId,
      receivedBy,
      quantityReceived,
      quantityDifference,
      observations,
      invoiceNumber,
      invoiceFileUrl,
      deliveryNoteUrl,
      photoEvidence
    } = await request.json();

    if (!purchaseOrderId || !receivedBy || !quantityReceived) {
      return NextResponse.json(
        { error: 'Campos requeridos: purchaseOrderId, receivedBy, quantityReceived' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO purchase_receptions (
        purchase_order_id,
        reception_date,
        received_by,
        quantity_received,
        quantity_difference,
        observations,
        invoice_number,
        invoice_file_url,
        delivery_note_url,
        photo_evidence,
        status
      )
      VALUES (
        ${parseInt(purchaseOrderId)},
        CURRENT_DATE,
        ${receivedBy},
        ${quantityReceived},
        ${quantityDifference || null},
        ${observations || null},
        ${invoiceNumber || null},
        ${invoiceFileUrl || null},
        ${deliveryNoteUrl || null},
        ${photoEvidence ? JSON.stringify(photoEvidence) : null},
        'recibido'
      )
      RETURNING *
    `;

    // Actualizar estatus de la orden de compra
    await sql`
      UPDATE purchase_orders
      SET status = 'material recibido', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(purchaseOrderId)}
    `;

    // Actualizar la solicitud relacionada
    const [order] = await sql`
      SELECT request_id FROM purchase_orders
      WHERE id = ${parseInt(purchaseOrderId)}
    `;

    if (order && order.request_id) {
      await sql`
        UPDATE purchase_requests
        SET status = 'material recibido', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${order.request_id}
      `;

      await sql`
        INSERT INTO purchase_request_status_history (
          request_id,
          status,
          changed_by,
          comments
        )
        VALUES (
          ${order.request_id},
          'material recibido',
          ${receivedBy},
          'Material recibido en almacén'
        )
      `;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating reception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
