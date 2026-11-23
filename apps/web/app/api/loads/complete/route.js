import {mexicoToday,validDate} from "@/utils/closing-period";
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
      customer_id,
      load_date,
      caliber_details = [],
      driver_name,
      truck_plates,
      trailer_plates,
      currency = 'USD',
      exchange_rate,
      notes,
      factura_folio
    } = body;

    if (!customer_id || !Array.isArray(caliber_details) || caliber_details.length === 0) {
      return NextResponse.json({ error: "customer_id y caliber_details requeridos" }, { status: 400 });
    }

    const customer = await sql`SELECT * FROM customers WHERE id = ${customer_id}`;
    if (!customer.length) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const selection = caliber_details.map(row => ({
      pallet_id:Number(row.pallet_id),
      boxes:Number(row.boxes),
      price:Number(row.price_per_box)
    }));
    const palletIds = selection.map(row => row.pallet_id);
    if (!selection.every(row => Number.isSafeInteger(row.pallet_id) && row.pallet_id > 0 &&
      Number.isSafeInteger(row.boxes) && row.boxes > 0 &&
      Number.isFinite(row.price) && row.price >= 0 && row.price <= 1000000000) ||
      new Set(palletIds).size !== palletIds.length) {
      return NextResponse.json({error:"Selecciona tarimas físicas distintas y verifica cajas y precios."},{status:400});
    }

    const loadDateStr = load_date || mexicoToday();
    if (!validDate(loadDateStr) || !['USD','MXN'].includes(currency)) {
      return NextResponse.json({error:"Verifica la fecha y moneda del embarque."},{status:400});
    }
    const fx = currency === 'MXN' ? null : Number(exchange_rate);
    if (currency === 'USD' && !(fx > 0 && fx <= 1000)) {
      return NextResponse.json({error:"Captura un tipo de cambio válido para el embarque en USD."},{status:400});
    }
    const [custTerms] = await sql`SELECT COALESCE(payment_terms_days,30) AS days FROM customers WHERE id=${customer_id}`;
    const due = new Date(loadDateStr + 'T00:00:00Z');
    due.setUTCDate(due.getUTCDate() + Number(custTerms.days));
    const fechaCompromiso = due.toISOString().slice(0,10);

    // Lock before reading stock, so two requests cannot dispatch the same tarima.
    const [, , [result]] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext('tecavo-confirm-shipment'))`,
      sql`SELECT id FROM pallet_output_summary WHERE id=ANY(${palletIds}::bigint[]) ORDER BY id FOR UPDATE`,
      sql`
        WITH requested AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(selection)}::jsonb)
          AS d(pallet_id bigint, boxes integer, price numeric)
        ), stock AS (
          SELECT p.id, p.lot_id, p.caliber, COALESCE(p.class_name,'') AS class_name,
                 p.total_kg, COALESCE(p.pallet_count,1) AS pallets,
                 r.boxes, r.price, round(r.boxes * r.price,2) AS amount
          FROM requested r JOIN pallet_output_summary p ON p.id=r.pallet_id
          WHERE p.embarque_id IS NULL AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
            AND p.total_kg > 0 AND p.lot_id IS NOT NULL
        ), totals AS (
          SELECT SUM(amount) AS amount, SUM(total_kg) AS kg FROM stock HAVING COUNT(*)=${selection.length}
        ), ref AS (
          SELECT COALESCE(NULLIF(${factura_folio || ''},''),
             'N-' || LPAD((COALESCE((SELECT MAX(substring(folio FROM 3)::bigint)
                    FROM notas WHERE folio ~ '^N-[0-9]{1,12}$'),0) + 1)::text,6,'0')) AS folio
        ), existing AS (
          SELECT h.id,h.factura_folio,
            (h.customer_id = ${customer_id} AND
             (SELECT array_agg(p.id::bigint ORDER BY p.id) FROM pallet_output_summary p
              JOIN load_history h2 ON h2.id = p.embarque_id WHERE h2.factura_folio=r.folio)
              = (SELECT array_agg(pallet_id ORDER BY pallet_id) FROM requested)) AS same_shipment
          FROM load_history h JOIN ref r ON h.factura_folio=r.folio
          ORDER BY h.id LIMIT 1
        ), note AS (
          INSERT INTO notas(folio,customer_id,viaje_id,fecha,importe_original_usd,total_abonado_usd,saldo_usd,fecha_compromiso,estatus)
          SELECT r.folio,${customer_id},NULL,${loadDateStr}::date,t.amount,0,t.amount,${fechaCompromiso}::date,'Pendiente'
          FROM totals t CROSS JOIN ref r WHERE NOT EXISTS (SELECT 1 FROM notas n WHERE n.folio=r.folio)
            AND NOT EXISTS (SELECT 1 FROM existing)
          RETURNING folio
        ), loads AS (
          INSERT INTO load_history(lot_id,load_date,customer_id,customer_name,destination,
            caliber,pallets_count,boxes_count,total_kg,unit_price,total_amount,currency,
            driver_name,truck_plates,trailer_plates,notes,payment_status,factura_folio)
          SELECT s.lot_id,${loadDateStr}::date,${customer_id},${customer[0].customer_name},${customer[0].destination || ''},
            string_agg(DISTINCT s.caliber,','),SUM(s.pallets),SUM(s.boxes),SUM(s.total_kg),MIN(s.price),SUM(s.amount),
            ${currency},${driver_name ?? null},${truck_plates ?? null},${trailer_plates ?? null},${notes ?? null},'pending',n.folio
          FROM stock s CROSS JOIN note n GROUP BY s.lot_id,n.folio
          RETURNING *
        ), details AS (
          INSERT INTO load_details(load_id,lot_id,caliber,class_name,pallets,boxes,total_kg,unit_price,subtotal)
          SELECT l.id,s.lot_id,s.caliber,s.class_name,s.pallets,s.boxes,s.total_kg,s.price,s.amount
          FROM stock s JOIN loads l USING(lot_id) RETURNING id
        ), dispatch AS (
          UPDATE pallet_output_summary p SET estado='EMBARCADA', embarque_id=l.id,
            version_registro=COALESCE(p.version_registro,1)+1,updated_at=NOW()
          FROM stock s JOIN loads l USING(lot_id) WHERE p.id=s.id RETURNING p.id
        ), receivable AS (
          INSERT INTO customer_accounts(customer_id,trip_type,trip_reference_id,trip_date,description,amount_usd,amount_mxn,exchange_rate,transaction_type,notes)
          SELECT ${customer_id},'load',l.id::text,${loadDateStr}::date,'Embarque '||l.id,
            CASE WHEN ${currency}='USD' THEN t.amount ELSE 0 END,
            CASE WHEN ${currency}='MXN' THEN t.amount ELSE 0 END,${fx},'receivable',${notes || ''}
          FROM (SELECT id FROM loads ORDER BY id LIMIT 1) l CROSS JOIN totals t RETURNING id
        )
        SELECT (SELECT to_jsonb(l) FROM loads l ORDER BY id LIMIT 1) AS load,
          (SELECT to_jsonb(e) FROM existing e) AS existing,
          (SELECT folio FROM note) AS folio,
          (SELECT kg FROM totals) AS kg,(SELECT amount FROM totals) AS amount,
          (SELECT jsonb_agg(lot_id) FROM loads) AS lot_ids,
          (SELECT count(*) FROM dispatch) AS pallet_count
      `
    ]);
    if (result.existing) {
      if (!factura_folio || !result.existing.same_shipment) return NextResponse.json({error:"Folio ocupado por otro embarque. Genera un folio nuevo."},{status:409});
      return NextResponse.json({deduped:true, load:result.existing, message:"Embarque ya confirmado."});
    }
    if (!result.load) return NextResponse.json({error:"Cambió el inventario o el folio ya está en uso. Revisa las tarimas seleccionadas."},{status:409});
    const {load:mainLoad, folio:notaFolio, lot_ids:affectedLots} = result;
    const finalTotalKg = Number(result.kg);
    const finalTotalAmount = Number(result.amount);
    const useLoad = mainLoad;

    // La confirmación ya es definitiva. Las integraciones derivadas pueden reintentarse por folio.
    let tripLinked = false;
    try {
      const { recalculateLot } = await import('@/app/api/utils/recalculate');
      for (const lid of affectedLots) {
        await recalculateLot(lid);
        await recalculateLotPerformance(lid);
      }
      await logMovement({ entity_type:'load',entity_id:useLoad.id,lot_id:affectedLots[0],
        movement_type:'VENTA_EMBARQUE',qty:finalTotalKg,unit:'kg',module:'embarques',
        reference:notaFolio,notes:`Embarque ${customer[0].customer_name} ${finalTotalKg}kg ${finalTotalAmount} ${currency}` });
      const trip = await syncCommercialTripFromLoad(useLoad.id,'embarque');
      tripLinked = Boolean(trip && !trip.skipped);
      if (driver_name) {
        await sql`INSERT INTO foreign_freights (load_id,lot_id,driver_name,truck_plates,trailer_plates,freight_date,notes)
          VALUES (${mainLoad.id},${affectedLots[0]},${driver_name},${truck_plates},${trailer_plates},${loadDateStr},${notes})`;
      }
    } catch(error) {
      console.error("Integración posterior de embarque:",notaFolio,error.message);
    }

    return NextResponse.json({
      load: mainLoad,
      totalAmount: finalTotalAmount,
      nota_folio: notaFolio,
      tripLinked,
      pallets_marked: Number(result.pallet_count),
      message: 'Una sola venta/CxC/nota/mapa/inventario/cierre (tarimas exactas)'
    });
  } catch (error) {
    console.error("Error in loads/complete confirm:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
