import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { logMovement, recalculateLotPerformance } from "@/app/api/utils/recalculate";

// POST - Create a new load (sale) and deduct inventory
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      customer_id,
      load_date,
      caliber_details, // [{ caliber, class_name, pallets, boxes, total_kg, price_per_kg }, ...]
      driver_name,
      truck_plates,
      trailer_plates,
      currency = 'MXN',
      notes,
      factura_folio,
      nota_total_amount,
      nota_total_kg
    } = body;

    if (!lot_id || !customer_id || !caliber_details || !Array.isArray(caliber_details)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Get customer info
    const customer = await sql`SELECT * FROM customers WHERE id = ${customer_id}`;
    if (!customer.length) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const loadDetails = [];
    let calculatedAmount = 0;

    // Process each caliber detail (calculated only - no double sum with nota_total_amount)
    for (const detail of caliber_details) {
      const quantity = parseFloat(detail.total_kg);

      // Check available inventory for this caliber
      const inventory = await sql`
        SELECT total_kg FROM lot_inventory
        WHERE lot_id = ${lot_id} AND caliber = ${detail.caliber} AND class_name = ${detail.class_name}
      `;

      if (!inventory.length || parseFloat(inventory[0].total_kg) < quantity) {
        return NextResponse.json(
          { error: `Insufficient inventory for caliber ${detail.caliber} class ${detail.class_name}` },
          { status: 400 }
        );
      }

      // Deduct from inventory (single source)
      await sql`
        UPDATE lot_inventory
        SET total_kg = total_kg - ${quantity}
        WHERE lot_id = ${lot_id} AND caliber = ${detail.caliber} AND class_name = ${detail.class_name}
      `;

      // Calculate amount for this caliber
      const caliberAmount = quantity * parseFloat(detail.price_per_kg);
      calculatedAmount += caliberAmount;

      // Store details for load_details table
      loadDetails.push({
        caliber: detail.caliber,
        class_name: detail.class_name,
        pallets: parseInt(detail.pallets) || 0,
        boxes: parseInt(detail.boxes) || 0,
        total_kg: quantity,
        unit_price: parseFloat(detail.price_per_kg),
        subtotal: caliberAmount
      });
    }

    const finalTotalAmount = parseFloat(nota_total_amount) > 0 ? parseFloat(nota_total_amount) : calculatedAmount;

    // Create load in load_history
    const physicalTotalKg = loadDetails.reduce((sum, d) => sum + d.total_kg, 0);
    const finalTotalKg = parseFloat(nota_total_kg) || physicalTotalKg;

    const load = await sql`
      INSERT INTO load_history (
        lot_id,
        load_date,
        customer_id,
        customer_name,
        destination,
        caliber,
        pallets_count,
        boxes_count,
        total_kg,
        unit_price,
        total_amount,
        currency,
        driver_name,
        truck_plates,
        trailer_plates,
        notes,
        payment_status,
        factura_folio,
        created_at
      )
      VALUES (
        ${lot_id},
        ${load_date},
        ${customer_id},
        ${customer[0].customer_name},
        ${customer[0].destination},
        ${loadDetails.map(d => d.caliber).join(', ')},
        ${loadDetails.reduce((sum, d) => sum + d.pallets, 0)},
        ${loadDetails.reduce((sum, d) => sum + d.boxes, 0)},
        ${finalTotalKg},
        ${loadDetails.length > 0 ? parseFloat(loadDetails[0].unit_price) : 0},
        ${finalTotalAmount},
        ${currency},
        ${driver_name},
        ${truck_plates},
        ${trailer_plates},
        ${notes},
        'pending',
        ${factura_folio || null},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    // Create load details records
    for (const detail of loadDetails) {
      await sql`
        INSERT INTO load_details (
          load_id,
          lot_id,
          caliber,
          class_name,
          pallets,
          boxes,
          total_kg,
          unit_price,
          subtotal
        )
        VALUES (
          ${load[0].id},
          ${lot_id},
          ${detail.caliber},
          ${detail.class_name},
          ${detail.pallets},
          ${detail.boxes},
          ${detail.total_kg},
          ${detail.unit_price},
          ${detail.subtotal}
        )
      `;
    }

    // Create entry in customer_trip_payments for payment tracking
    await sql`
      INSERT INTO customer_accounts (
        customer_id,
        trip_type,
        trip_reference_id,
        trip_date,
        description,
        amount_mxn,
        transaction_type,
        notes
      )
      VALUES (
        ${customer_id},
        'load',
        ${String(load[0].id)},
        ${load_date},
        ${'Load ' + load[0].id},
        ${finalTotalAmount},
        'receivable',
        ${notes || ''}
      )
    `;

    // Update lot totals via canonical recalc (no += )
    const totalKgSold = loadDetails.reduce((sum, d) => sum + d.total_kg, 0);
    const { recalculateLot } = await import('@/app/api/utils/recalculate');
    await recalculateLot(lot_id);
    await sql`
      UPDATE lots
      SET 
        total_revenue = COALESCE(total_revenue,0) + ${finalTotalAmount},
        lot_traceability_status = 'sales_completed'
      WHERE id = ${lot_id}
    `;

    // CRITICAL FIX: Only mark the pallets involved in THIS load (by caliber/class) not the entire lot.
    // Only affect selected calibers from the details, and only non-embarked.
    try {
      for (const d of loadDetails) {
        await sql`
          UPDATE pallet_output_summary
          SET estado = 'EMBARCADA', embarque_id = ${load[0].id}, version_registro = COALESCE(version_registro,1)+1, updated_at = NOW()
          WHERE lot_id = ${lot_id}
            AND caliber = ${d.caliber}
            AND COALESCE(class_name,'') = COALESCE(${d.class_name},'')
            AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA')
          LIMIT 1
        `;
      }
    } catch(_) {}

    // Central Libro de Movimientos + balance
    await logMovement({
      entity_type: 'load',
      entity_id: load[0].id,
      lot_id,
      movement_type: 'VENTA_EMBARQUE',
      qty_before: 0,
      qty: totalKgSold,
      qty_after: totalKgSold,
      unit: 'kg',
      module: 'embarques',
      reference: String(factura_folio || ('load-' + load[0].id)),
      notes: `Carga a ${customer[0].customer_name} • ${totalKgSold}kg • ${finalTotalAmount}`
    });
    await recalculateLotPerformance(lot_id);

    // Create foreign freight entry if needed
    if (driver_name) {
      await sql`
        INSERT INTO foreign_freights (
          load_id,
          lot_id,
          driver_name,
          truck_plates,
          trailer_plates,
          freight_date,
          notes
        )
        VALUES (
          ${load[0].id},
          ${lot_id},
          ${driver_name},
          ${truck_plates},
          ${trailer_plates},
          ${load_date},
          ${notes}
        )
      `;
    }

    return NextResponse.json({
      load: load[0],
      details: loadDetails,
      totalAmount: finalTotalAmount,
      factura_folio: factura_folio || null
    });
  } catch (error) {
    console.error("Error in POST /api/loads/complete:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
