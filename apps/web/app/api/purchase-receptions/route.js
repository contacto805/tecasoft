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

    // === INVENTARIO ÚNICO: Actualizar stock del material vinculado (si hay product_or_service o material_id en PO) ===
    try {
      const [po] = await sql`SELECT product_or_service, supplier_name, total, supplier_rfc, folio FROM purchase_orders WHERE id = ${parseInt(purchaseOrderId)}`;
      if (po && po.product_or_service) {
        // Buscar material por nombre aproximado
        const [mat] = await sql`
          SELECT id, quantity_available, costo_promedio, cost_per_unit, unit, factor_conversion 
          FROM materials_inventory 
          WHERE LOWER(material_name) LIKE ${'%' + po.product_or_service.toLowerCase().slice(0,30) + '%'} 
          LIMIT 1
        `;
        if (mat) {
          const factor = parseFloat(mat.factor_conversion || 1) || 1;
          const addQty = parseFloat(quantityReceived) * factor;
          const newStock = parseFloat(mat.quantity_available || 0) + addQty;
          const newCost = parseFloat(cost_per_unit || mat.cost_per_unit || 0);

          const oldQty = parseFloat(mat.quantity_available || 0);
          const oldC = parseFloat(mat.costo_promedio || mat.cost_per_unit || 0);
          const total = oldQty + addQty;
          const prom = total > 0 ? ((oldQty * oldC) + (addQty * newCost)) / total : newCost;

          await sql`
            UPDATE materials_inventory 
            SET quantity_available = ${newStock}, 
                costo_promedio = ${prom},
                last_purchase_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${mat.id}
          `;

          await sql`
            INSERT INTO movements (entity_type, entity_id, movement_type, qty, qty_before, qty_after, unit, module, reference, notes, created_at)
            VALUES ('material', ${mat.id}, 'ENTRADA_COMPRA', ${addQty}, ${oldQty}, ${newStock}, ${mat.unit}, 'inventario', ${invoiceNumber || 'REC-' + result.id}, ${'Recepción PO#' + purchaseOrderId + ' proveedor ' + (po.supplier_name || '')}, CURRENT_TIMESTAMP)
          `;
        }
      }

      // === OBLIGACIÓN ÚNICA CxP PROVEEDOR (payment_schedule): reconoce al recibir+factura. Una sola por PO/invoice.
      // Pago posterior reduce banco + saldo, NO vuelve a causar gasto (costo ya en inventario/movements).
      if (po && (invoiceNumber || po.folio)) {
        const existingObl = await sql`
          SELECT id, monto_pagado, saldo_pendiente FROM payment_schedule 
          WHERE owner_type = 'supplier' AND (invoice_number = ${invoiceNumber || null} OR concept ILIKE ${'%PO#' + purchaseOrderId + '%'})
          LIMIT 1
        `;
        const amt = parseFloat(po.total || 0);
        if (amt > 0) {
          if (existingObl.length > 0) {
            const curr = existingObl[0];
            const pag = parseFloat(curr.monto_pagado || 0);
            await sql`
              UPDATE payment_schedule SET
                amount = ${amt},
                saldo_pendiente = ${Math.max(0, amt - pag)},
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${curr.id}
            `;
          } else {
            const year = new Date().getFullYear();
            const last = await sql`SELECT folio FROM payment_schedule WHERE folio LIKE ${'PAG-' + year + '-%'} ORDER BY id DESC LIMIT 1`;
            let nn = 1; if (last.length) nn = (parseInt(String(last[0].folio).split('-')[2]) || 0) + 1;
            const pfolio = `PAG-${year}-${String(nn).padStart(3,'0')}`;
            await sql`
              INSERT INTO payment_schedule (
                folio, producer_name, beneficiary_name, concept, amount,
                fruit_reception_date, due_date, scheduled_payment_date,
                payment_days, priority, status, created_by, owner_type,
                invoice_number, rfc, monto_pagado, saldo_pendiente
              ) VALUES (
                ${pfolio}, ${po.supplier_name || 'Proveedor'}, ${po.supplier_name || 'Proveedor'},
                ${'Compra material/servicio PO#' + purchaseOrderId + ' ' + (po.folio || '')},
                ${amt}, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days',
                30, 'normal', 'scheduled', ${receivedBy || 'sistema'}, 'supplier',
                ${invoiceNumber || null}, ${po.supplier_rfc || null}, 0, ${amt}
              )
            `;
          }
        }
      }
    } catch(e) { /* non fatal for inventory/obligation */ }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating reception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
