import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener órdenes de compra
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const requestId = searchParams.get('requestId');

    let where = sql`WHERE 1=1`;
    
    if (status) {
      where = sql`${where} AND status = ${status}`;
    }
    
    if (requestId) {
      where = sql`${where} AND request_id = ${parseInt(requestId)}`;
    }

    const orders = await sql`
      SELECT * FROM purchase_orders
      ${where}
      ORDER BY order_date DESC
    `;

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear orden de compra
export async function POST(request) {
  try {
    const {
      requestId,
      supplierId,
      supplierName,
      supplierRfc,
      supplierAddress,
      supplierEmail,
      supplierPhone,
      productOrService,
      quantity,
      unitPrice,
      tax,
      paymentTerms,
      deliveryDate,
      notes,
      authorizedBy
    } = await request.json();

    if (!supplierName || !productOrService || !quantity || !unitPrice) {
      return NextResponse.json(
        { error: 'Campos requeridos: supplierName, productOrService, quantity, unitPrice' },
        { status: 400 }
      );
    }

    // Generar folio consecutivo
    const [lastOrder] = await sql`
      SELECT folio FROM purchase_orders
      ORDER BY id DESC
      LIMIT 1
    `;

    let folioNumber = 1;
    if (lastOrder) {
      const match = lastOrder.folio.match(/OC-\d{4}-(\d+)/);
      if (match) {
        folioNumber = parseInt(match[1]) + 1;
      }
    }

    const year = new Date().getFullYear();
    const folio = `OC-${year}-${String(folioNumber).padStart(4, '0')}`;

    const subtotal = quantity * unitPrice;
    const taxAmount = tax || subtotal * 0.16;
    const total = subtotal + taxAmount;

    const [result] = await sql`
      INSERT INTO purchase_orders (
        folio,
        request_id,
        order_date,
        supplier_id,
        supplier_name,
        supplier_rfc,
        supplier_address,
        supplier_email,
        supplier_phone,
        product_or_service,
        quantity,
        unit_price,
        subtotal,
        tax,
        total,
        payment_terms,
        delivery_date,
        status,
        authorized_by,
        authorized_at,
        notes
      )
      VALUES (
        ${folio},
        ${requestId ? parseInt(requestId) : null},
        CURRENT_DATE,
        ${supplierId ? parseInt(supplierId) : null},
        ${supplierName},
        ${supplierRfc || null},
        ${supplierAddress || null},
        ${supplierEmail || null},
        ${supplierPhone || null},
        ${productOrService},
        ${quantity},
        ${unitPrice},
        ${subtotal},
        ${taxAmount},
        ${total},
        ${paymentTerms || null},
        ${deliveryDate || null},
        'autorizado',
        ${authorizedBy || null},
        CURRENT_TIMESTAMP,
        ${notes || null}
      )
      RETURNING *
    `;

    // Actualizar estatus de la solicitud
    if (requestId) {
      await sql`
        UPDATE purchase_requests
        SET status = 'orden de compra generada', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(requestId)}
      `;

      await sql`
        INSERT INTO purchase_request_status_history (
          request_id,
          status,
          changed_by,
          comments
        )
        VALUES (
          ${parseInt(requestId)},
          'orden de compra generada',
          ${authorizedBy || 'Sistema'},
          ${`Orden de compra ${folio} generada`}
        )
      `;
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar orden de compra
export async function PUT(request) {
  try {
    const { id, status, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    let updateFields = sql``;
    const fields = [];

    if (status) {
      fields.push(sql`status = ${status}`);
    }

    if (updates.deliveryDate) {
      fields.push(sql`delivery_date = ${updates.deliveryDate}`);
    }

    if (updates.notes) {
      fields.push(sql`notes = ${updates.notes}`);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    fields.push(sql`updated_at = CURRENT_TIMESTAMP`);

    for (let i = 0; i < fields.length; i++) {
      if (i === 0) {
        updateFields = fields[i];
      } else {
        updateFields = sql`${updateFields}, ${fields[i]}`;
      }
    }

    const [result] = await sql`
      UPDATE purchase_orders
      SET ${updateFields}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
