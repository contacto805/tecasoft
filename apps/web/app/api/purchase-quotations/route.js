import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener cotizaciones de una solicitud
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId es requerido' },
        { status: 400 }
      );
    }

    const quotations = await sql`
      SELECT * FROM purchase_quotations
      WHERE request_id = ${parseInt(requestId)}
      ORDER BY 
        is_selected DESC,
        total_price ASC
    `;

    return NextResponse.json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar cotización
export async function POST(request) {
  try {
    const {
      requestId,
      supplierId,
      supplierName,
      unitPrice,
      totalPrice,
      deliveryTime,
      paymentTerms,
      warranty,
      quotationFileUrl
    } = await request.json();

    if (!requestId || !supplierName || !totalPrice) {
      return NextResponse.json(
        { error: 'Campos requeridos: requestId, supplierName, totalPrice' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO purchase_quotations (
        request_id,
        supplier_id,
        supplier_name,
        unit_price,
        total_price,
        delivery_time,
        payment_terms,
        warranty,
        quotation_file_url
      )
      VALUES (
        ${parseInt(requestId)},
        ${supplierId ? parseInt(supplierId) : null},
        ${supplierName},
        ${unitPrice || null},
        ${totalPrice},
        ${deliveryTime || null},
        ${paymentTerms || null},
        ${warranty || null},
        ${quotationFileUrl || null}
      )
      RETURNING *
    `;

    // Actualizar estatus de la solicitud
    await sql`
      UPDATE purchase_requests
      SET status = 'cotización recibida', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(requestId)}
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Seleccionar cotización ganadora
export async function PUT(request) {
  try {
    const { id, requestId } = await request.json();

    if (!id || !requestId) {
      return NextResponse.json(
        { error: 'id y requestId son requeridos' },
        { status: 400 }
      );
    }

    // Desmarcar todas las cotizaciones de la solicitud
    await sql`
      UPDATE purchase_quotations
      SET is_selected = false
      WHERE request_id = ${parseInt(requestId)}
    `;

    // Marcar la seleccionada
    const [result] = await sql`
      UPDATE purchase_quotations
      SET is_selected = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar estatus de la solicitud
    await sql`
      UPDATE purchase_requests
      SET status = 'pendiente autorización', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(requestId)}
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error selecting quotation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
