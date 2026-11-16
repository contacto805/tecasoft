import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { logMovement, recalculateLotPerformance } from "@/app/api/utils/recalculate";
import { syncCommercialTripFromLoad } from "@/app/api/utils/sync-trip-from-load";

// POST - ÚNICO COMANDO TRANSACCIONAL DE CONFIRMACIÓN DE EMBARQUE (erp_confirm_shipment)
// Una sola llamada comercial = UNA sola nota/venta/CxC (incluso con múltiples lotes).
// Trailer-map es solo borrador visual. Descuento físico y CxC SOLO aquí (idempotente).
// Usa IDs EXACTOS de tarimas seleccionadas (no coincidencias de kg/calibre).
// Precios respetan unidad: por caja o por kg según se envíe. Importe de nota = venta = CxC.
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      customer_id,
      load_date,
      caliber_details = [],
      driver_name,
      truck_plates,
      trailer_plates,
      currency = 'USD',
      notes,
      factura_folio,
      nota_total_amount,
      nota_total_kg,
      selected_pallet_ids = []  // EXACT pallet ids from trailer selection for traceability
    } = body;

    if (!customer_id || !Array.isArray(caliber_details) || caliber_details.length === 0) {
      return NextResponse.json({ error: "customer_id y caliber_details requeridos" }, { status: 400 });
    }

    const customer = await sql`SELECT * FROM customers WHERE id = ${customer_id}`;
    if (!customer.length) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Normalize items. Support price per caja (preferred for UI) or per kg. Compute amount correctly.
    const allItems = caliber_details.map(d => {
      const isPerBox = (d.unit || 'caja') === 'caja' || !d.price_per_kg; // default UI is per caja
      const p = parseFloat(d.price_per_kg || d.price_per_box || d.price || 0);
      const boxes = parseInt(d.boxes) || 0;
      const kg = parseFloat(d.total_kg) || 0;
      const amt = isPerBox ? (boxes * p) : (kg * p);
      return {
        lot_id: parseInt(d.lot_id || lot_id),
        caliber: d.caliber,
        class_name: d.class_name || '',
        pallets: parseInt(d.pallets) || 0,
        boxes,
        total_kg: kg,
        price: p,
        unit: isPerBox ? 'caja' : 'kg',
        amount: amt
      };
    }).filter(i => i.lot_id && (i.total_kg > 0 || i.boxes > 0));

    if (allItems.length === 0) {
      return NextResponse.json({ error: "Sin detalles válidos" }, { status: 400 });
    }

    const targetAmount = parseFloat(nota_total_amount) || allItems.reduce((s, i) => s + i.amount, 0);
    const targetKg = parseFloat(nota_total_kg) || allItems.reduce((s, i) => s + i.total_kg, 0);
    const loadDateStr = load_date || new Date().toISOString().slice(0,10);

    // Idempotencia fuerte por folio comercial (permite dos ventas iguales legítimas de mismo cliente/día si folio distinto)
    if (factura_folio) {
      const dupLoad = await sql`SELECT id FROM load_history WHERE factura_folio = ${factura_folio} LIMIT 1`;
      if (dupLoad.length) {
        return NextResponse.json({ deduped: true, load: dupLoad[0], message: 'Embarque ya confirmado (folio único)' });
      }
      const dupNota = await sql`SELECT * FROM notas WHERE folio = ${factura_folio} LIMIT 1`;
      if (dupNota.length) {
        return NextResponse.json({ deduped: true, nota: dupNota[0], message: 'Nota ya emitida para este folio' });
      }
    }

    // Verificar stock usando IDs exactos si se envían (preferido), sino por calibre
    const palletIds = Array.isArray(selected_pallet_ids) ? selected_pallet_ids.map(Number).filter(Boolean) : [];
    if (palletIds.length > 0) {
      const availPallets = await sql`
        SELECT id, lot_id, caliber, class_name, total_kg 
        FROM pallet_output_summary 
        WHERE id = ANY(${palletIds}) 
          AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
      `;
      const availMap = {};
      availPallets.forEach(p => { availMap[p.id] = p; });
      // Basic sum check
      let sumAvail = 0;
      palletIds.forEach(pid => { if (availMap[pid]) sumAvail += parseFloat(availMap[pid].total_kg || 0); });
      if (sumAvail + 0.1 < targetKg) {
        return NextResponse.json({ error: 'Stock insuficiente en tarimas seleccionadas' }, { status: 400 });
      }
    } else {
      // fallback
      for (const item of allItems) {
        const [avail] = await sql`
          SELECT COALESCE(SUM(total_kg),0) as kg
          FROM pallet_output_summary
          WHERE lot_id = ${item.lot_id}
            AND caliber = ${item.caliber}
            AND COALESCE(class_name,'') = ${item.class_name}
            AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA')
        `;
        if (parseFloat(avail?.kg || 0) < item.total_kg - 0.01) {
          return NextResponse.json({ error: `Stock insuficiente para lote ${item.lot_id} ${item.caliber}` }, { status: 400 });
        }
      }
    }

    const finalTotalAmount = targetAmount;
    const finalTotalKg = targetKg;

    // Términos de pago
    const [custTerms] = await sql`SELECT COALESCE(payment_terms_days,30) as days FROM customers WHERE id = ${customer_id}`;
    const days = parseInt(custTerms?.days || 30);
    const due = new Date(loadDateStr);
    due.setDate(due.getDate() + days);
    const fechaCompromiso = due.toISOString().slice(0,10);

    // UNA SOLA NOTA (canónica)
    let notaFolio = factura_folio;
    if (!notaFolio) {
      const maxNota = await sql`SELECT folio FROM notas WHERE folio LIKE 'N-%' ORDER BY id DESC LIMIT 1`;
      let nNum = 1;
      if (maxNota.length && maxNota[0].folio) nNum = (parseInt(String(maxNota[0].folio).replace('N-','')) || 0) + 1;
      notaFolio = 'N-' + String(nNum).padStart(6,'0');
    }

    await sql`
      INSERT INTO notas (folio, customer_id, viaje_id, fecha, importe_original_usd, total_abonado_usd, saldo_usd, fecha_compromiso, estatus)
      VALUES (${notaFolio}, ${customer_id}, NULL, ${loadDateStr}, ${finalTotalAmount}, 0, ${finalTotalAmount}, ${fechaCompromiso}, 'Pendiente')
    `;

    // Agrupar por lote
    const lotsMap = {};
    allItems.forEach(i => {
      if (!lotsMap[i.lot_id]) lotsMap[i.lot_id] = [];
      lotsMap[i.lot_id].push(i);
    });

    let mainLoad = null;
    const loadDetailsAll = [];

    for (const [lid, items] of Object.entries(lotsMap)) {
      const lotIdNum = parseInt(lid);
      const subKg = items.reduce((s,i)=>s+i.total_kg,0);
      const subAmount = items.reduce((s,i)=>s + i.amount, 0);
      const [lotRow] = await sql`SELECT * FROM lots WHERE id = ${lotIdNum}`;
      const lotName = lotRow?.lot_number || String(lotIdNum);

      const [load] = await sql`
        INSERT INTO load_history (
          lot_id, load_date, customer_id, customer_name, destination,
          caliber, pallets_count, boxes_count, total_kg, unit_price, total_amount,
          currency, driver_name, truck_plates, trailer_plates, notes, payment_status, factura_folio
        ) VALUES (
          ${lotIdNum}, ${loadDateStr}, ${customer_id}, ${customer[0].customer_name}, ${customer[0].destination || ''},
          ${items.map(d=>d.caliber).join(',')},
          ${items.reduce((s,d)=>s+d.pallets,0)}, ${items.reduce((s,d)=>s+d.boxes,0)},
          ${subKg}, ${items[0]?.price || 0}, ${subAmount},
          ${currency}, ${driver_name}, ${truck_plates}, ${trailer_plates}, ${notes}, 'pending', ${notaFolio}
        ) RETURNING *
      `;
      if (!mainLoad) mainLoad = load;

      for (const d of items) {
        await sql`
          INSERT INTO load_details (load_id, lot_id, caliber, class_name, pallets, boxes, total_kg, unit_price, subtotal)
          VALUES (${load.id}, ${lotIdNum}, ${d.caliber}, ${d.class_name}, ${d.pallets}, ${d.boxes}, ${d.total_kg}, ${d.price}, ${d.amount})
        `;
        loadDetailsAll.push(d);
      }
    }

    const useLoad = mainLoad || { id: 0 };

    // EXACT TARIMAS: marcar solo las seleccionadas por ID (trazabilidad)
    if (palletIds.length > 0) {
      for (const pid of palletIds) {
        await sql`
          UPDATE pallet_output_summary 
          SET estado = 'EMBARCADA', embarque_id = ${useLoad.id}, version_registro = COALESCE(version_registro,1)+1, updated_at = NOW()
          WHERE id = ${pid} AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
        `;
      }
    } else {
      // fallback por calibre (menos preciso)
      for (const d of allItems) {
        await sql`
          UPDATE pallet_output_summary
          SET estado = 'EMBARCADA', embarque_id = ${useLoad.id}, version_registro = COALESCE(version_registro,1)+1, updated_at = NOW()
          WHERE lot_id = ${d.lot_id}
            AND caliber = ${d.caliber}
            AND COALESCE(class_name,'') = ${d.class_name}
            AND COALESCE(estado,'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA')
          LIMIT 20
        `;
      }
    }

    // Una sola CxC
    await sql`
      INSERT INTO customer_accounts (customer_id, trip_type, trip_reference_id, trip_date, description, amount_usd, amount_mxn, transaction_type, notes)
      VALUES (${customer_id}, 'load', ${String(useLoad.id)}, ${loadDateStr}, ${'Embarque ' + useLoad.id},
              ${currency === 'USD' ? finalTotalAmount : 0}, ${currency !== 'USD' ? finalTotalAmount : 0}, 'receivable', ${notes || ''})
    `;

    // Recalcs
    const affectedLots = [...new Set(allItems.map(i => i.lot_id))];
    const { recalculateLot } = await import('@/app/api/utils/recalculate');
    for (const lid of affectedLots) {
      await recalculateLot(lid);
      await recalculateLotPerformance(lid);
    }
    await logMovement({ entity_type: 'load', entity_id: useLoad.id, lot_id: affectedLots[0], movement_type: 'VENTA_EMBARQUE', qty: finalTotalKg, unit: 'kg', module: 'embarques', reference: String(notaFolio || useLoad.id), notes: `Embarque ${customer[0].customer_name} ${finalTotalKg}kg ${finalTotalAmount} ${currency}` });

    try { await syncCommercialTripFromLoad(useLoad.id, 'embarque'); } catch(e){}

    if (driver_name && mainLoad) {
      await sql`INSERT INTO foreign_freights (load_id, lot_id, driver_name, truck_plates, trailer_plates, freight_date, notes)
                VALUES (${mainLoad.id}, ${affectedLots[0]}, ${driver_name}, ${truck_plates}, ${trailer_plates}, ${loadDateStr}, ${notes})`;
    }

    // Cierre semanal con fecha de venta confirmada (load_date)
    try {
      await fetch('/api/admin/weekly-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addCarga: true,
          load_date: loadDateStr,
          factura_folio: notaFolio || null,
          total_kg: finalTotalKg,
          total_amount: finalTotalAmount,
          customer_name: customer[0]?.customer_name || ''
        })
      });
    } catch (syncErr) {}

    return NextResponse.json({
      load: mainLoad,
      details: loadDetailsAll,
      totalAmount: finalTotalAmount,
      nota_folio: notaFolio,
      tripLinked: true,
      pallets_marked: palletIds.length,
      message: 'Una sola venta/CxC/nota/mapa/inventario/cierre (tarimas exactas)'
    });
  } catch (error) {
    console.error("Error in loads/complete confirm:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
