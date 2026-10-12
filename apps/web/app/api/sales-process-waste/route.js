import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (lotId) {
      // Get sales records for a specific lot
      const records = await sql`
        SELECT 
          spw.*,
          l.lot_number,
          l.producer,
          l.fruit_type,
          l.fruit_price,
          l.collector_name,
          lr.id as lotification_id,
          lr.total_kg_processed,
          lr.total_kg_waste,
          lr.total_kg_loss,
          COALESCE(spw.calculated_price, 0) as final_price
        FROM sales_of_process_and_waste spw
        LEFT JOIN lots l ON spw.lot_id = l.id
        LEFT JOIN lotification_records lr ON spw.lot_id = lr.lot_id
        WHERE spw.lot_id = ${lotId ? parseInt(lotId) : null}
        ORDER BY spw.created_at DESC
      `;
      const safeLot = (records || []).map(r => {
        const o = {...r};
        Object.keys(o).forEach(k => { const v = o[k]; if (v === undefined || (typeof v === 'number' && isNaN(v))) o[k] = null; });
        return o;
      });
      return NextResponse.json(safeLot);
    }

    // Special mode: Lote de Origen (auto-generated from Registro de Lotificación)
    // Only pure stubs (no price / no buyer) with pending kg for selection
    if (searchParams.get('origen') === 'true') {
      const origins = await sql`
        SELECT 
          spw.*,
          l.lot_number,
          l.producer,
          l.fruit_type,
          l.date as lot_date
        FROM sales_of_process_and_waste spw
        LEFT JOIN lots l ON spw.lot_id = l.id
        WHERE spw.product_name IN ('Proceso', 'Desecho')
          AND (COALESCE(spw.process_kg, 0) > 0 OR COALESCE(spw.waste_kg, 0) > 0)
          AND COALESCE(spw.unit_price, 0) = 0
          AND (COALESCE(spw.buyer_name, '') = '' OR spw.buyer_name IS NULL)
        ORDER BY spw.created_at DESC
      `;
      return NextResponse.json(origins);
    }

    // Get all sales records with lot and lotification details
    // Include actual sales (even proceso/desecho types if they have price/buyer/boxes)
    // Exclude only pending Lote de Origen stubs (no buyer and no unit price)
    const allRecords = await sql`
      SELECT 
        spw.*,
        l.lot_number,
        l.producer,
        l.origin,
        l.fruit_type,
        l.fruit_price,
        l.collector_name,
        lr.id as lotification_id,
        lr.total_kg_processed,
        lr.total_kg_waste,
        lr.total_kg_loss,
        COALESCE(spw.calculated_price, 0) as final_price
      FROM sales_of_process_and_waste spw
      LEFT JOIN lots l ON spw.lot_id = l.id
      LEFT JOIN lotification_records lr ON spw.lot_id = lr.lot_id
      WHERE NOT (
        COALESCE(spw.product_name, '') IN ('Proceso', 'Desecho')
        AND COALESCE(spw.unit_price, 0) = 0
        AND (COALESCE(spw.buyer_name, '') = '' OR spw.buyer_name IS NULL)
      )
      ORDER BY spw.created_at DESC
    `;

    // Sanitize null/undefined/Nan to safe values before response
    const safeAll = (allRecords || []).map(r => {
      const o = {...r};
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (v === undefined || (typeof v === 'number' && isNaN(v))) o[k] = null;
      });
      return o;
    });
    return NextResponse.json(safeAll);
  } catch (error) {
    console.error('Error in GET /api/sales-process-waste:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // NEW: Inventory auto-generation mode from Registro de Lotificación
    const productName = body.productName || body.product_name;
    if (productName && (productName === 'Proceso' || productName === 'Desecho') && body.kg != null) {
      const kgVal = parseFloat(body.kg) || 0;
      const isProceso = productName === 'Proceso';
      const processKg = isProceso ? kgVal : 0;
      const wasteKg = isProceso ? 0 : kgVal;

      const result = await sql`
        INSERT INTO sales_of_process_and_waste (
          lot_id,
          source_batch_number,
          date,
          product_name,
          process_kg,
          waste_kg,
          notes,
          payment_status,
          buyer_name,
          destination
        ) VALUES (
          ${body.lotId ? parseInt(body.lotId) : null},
          ${body.lotNumber || body.sourceBatchNumber || ''},
          ${body.date || new Date().toISOString().split('T')[0]},
          ${productName},
          ${processKg},
          ${wasteKg},
          ${body.notes || 'Generado automáticamente desde Registro de Lotificación'},
          'pendiente',
          '',
          ''
        )
        RETURNING *
      `;
    if (!result || result.length === 0) {
      return NextResponse.json({ message: 'Error al guardar inventario', error: 'NO_RESULT' }, { status: 500 });
    }
    const r0 = result[0] || {};
    Object.keys(r0).forEach(k => { const v = r0[k]; if (v === undefined || (typeof v === 'number' && isNaN(v))) r0[k] = null; });
    return NextResponse.json(r0);
    }

    // Original manual sale record
    const {
      lotId,
      boxCount,
      withPallet,
      grossWeight,
      netWeight,
      unitPrice,
      totalPrice,
      notes,
      paymentStatus = 'pendiente',
      master_batch_id,
      productType,
      buyerName,
      destination
    } = body;

    if (!boxCount || !grossWeight || !netWeight || !unitPrice) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos', error: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    let batchId = master_batch_id;
    if (!batchId && lotId) {
      const existingBatch = await sql`
        SELECT id FROM master_batches 
        WHERE lot_id = ${parseInt(lotId)} 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      if (existingBatch.length > 0) batchId = existingBatch[0].id;
    }

    const calculatedPrice = (parseFloat(netWeight) || 0) * (parseFloat(unitPrice) || 0);

    // Auto from Lote de Origen: set type and appropriate kg values (Proceso / Desecho)
    const pType = productType || '';
    let insProcessKg = 0;
    let insWasteKg = 0;
    let insProductName = pType || '';
    const soldNet = parseFloat(netWeight) || 0;
    if (pType === 'Proceso') {
      insProcessKg = soldNet;
      insWasteKg = 0;
    } else if (pType === 'Desecho') {
      insProcessKg = 0;
      insWasteKg = soldNet;
    } else {
      insProcessKg = soldNet;
      insWasteKg = 0;
    }

    const result = await sql`
      INSERT INTO sales_of_process_and_waste (
        lot_id,
        master_batch_id,
        boxes,
        with_pallet,
        gross_weight,
        net_weight,
        unit_price,
        total_price,
        notes,
        date,
        source_batch_number,
        sales_folio,
        product_name,
        process_kg,
        waste_kg,
        shrinkage_kg,
        payment_status,
        buyer_name,
        destination
      ) VALUES (
        ${lotId ? parseInt(lotId) : null},
        ${batchId || null},
        ${parseInt(boxCount) || 0},
        ${withPallet || false},
        ${parseFloat(grossWeight) || 0},
        ${parseFloat(netWeight) || 0},
        ${parseFloat(unitPrice) || 0},
        ${parseFloat(totalPrice) || calculatedPrice},
        ${notes || ''},
        ${new Date().toISOString().split('T')[0]},
        '',
        '',
        ${insProductName},
        ${insProcessKg},
        ${insWasteKg},
        0,
        ${paymentStatus},
        ${buyerName || ''},
        ${destination || ''}
      )
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { message: 'Error al guardar el registro', error: 'NO_RESULT' },
        { status: 500 }
      );
    }
    const sr = result[0] || {};
    Object.keys(sr).forEach(k => { const v = sr[k]; if (v === undefined || (typeof v === 'number' && isNaN(v))) sr[k] = null; });
    return NextResponse.json(sr);
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { message: 'Error al guardar el registro: ' + error.message, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      lotId,
      boxCount,
      withPallet,
      grossWeight,
      netWeight,
      unitPrice,
      totalPrice,
      notes,
      paymentStatus,
      master_batch_id,
      buyerName,
      destination,
      productType,
      date
    } = body;

    if (!id) {
      return NextResponse.json({ message: 'ID requerido', error: 'MISSING_ID' }, { status: 400 });
    }

    // Calculate price based on net weight and unit price
    const calculatedPrice = (parseFloat(totalPrice) || (parseFloat(netWeight) || 0) * (parseFloat(unitPrice) || 0));

    const pType = productType || body.product_name || '';

    const result = await sql`
      UPDATE sales_of_process_and_waste
      SET
        lot_id = ${lotId ? parseInt(lotId) : null},
        boxes = ${parseInt(boxCount) || 0},
        with_pallet = ${withPallet || false},
        gross_weight = ${parseFloat(grossWeight) || 0},
        net_weight = ${parseFloat(netWeight) || 0},
        unit_price = ${parseFloat(unitPrice) || 0},
        total_price = ${calculatedPrice},
        notes = ${notes || ''},
        buyer_name = ${buyerName || ''},
        destination = ${destination || ''},
        product_name = ${pType},
        payment_status = ${paymentStatus || 'pendiente'},
        date = ${date || body.sale_date || null},
        master_batch_id = ${master_batch_id || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { message: 'Registro no encontrado', error: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    const ur = result[0] || {};
    Object.keys(ur).forEach(k => { const v = ur[k]; if (v === undefined || (typeof v === 'number' && isNaN(v))) ur[k] = null; });
    return NextResponse.json(ur);
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { message: 'Error al actualizar: ' + error.message, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
    }

    const numId = parseInt(id);
    await sql`DELETE FROM sales_of_process_and_waste WHERE id = ${numId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ success: false, message: 'Error al eliminar: ' + error.message }, { status: 500 });
  }
}
