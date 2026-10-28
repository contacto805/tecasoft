import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getCurrentUser, isSuperAdmin, sanitizeForNonSuper } from "@/app/api/utils/super-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const status = searchParams.get("status");
    const callerIsSuper = await isSuperAdmin();

    let query = sql`
      SELECT * FROM cutting_orders 
      ORDER BY created_at DESC 
      LIMIT 200
    `;

    if (lotId) {
      query = sql`
        SELECT * FROM cutting_orders 
        WHERE lot_id = ${lotId}
        ORDER BY created_at DESC
      `;
    }

    if (status) {
      query = sql`
        SELECT * FROM cutting_orders 
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    const orders = await query;
    const safe = (orders || []).map(o => sanitizeForNonSuper(o, callerIsSuper));
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Error fetching cutting orders:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const {
    folio,
    cutting_date,
    producer_name,
    orchard_name,
    location,
    scale,
    meeting_point,
    truck_plates,
    truck_type,
    freight_cost,
    driver_name,
    crew_chief_name,
    crew_payment_method,
    crew_workers_count,
    boxes_count,
    lot_id,
    master_batch_id,
    user_id,
    user_name,
    crew_chief_phone,
    driver_phone,
    contact_name,
    contact_phone,
    meeting_time,
    orchard_plant_type,
    orchard_terrain_type,
    orchard_cutting_type,
    orchard_specifications,
    packing_house_address,
    broker_name,
    agreed_commission,
    agreed_price_per_kg,
    show_agreed_price,
    destination,
    client_name,
    plazo_dias,
    tipo_dias,
    entrega_estimada
  } = await request.json();
  
  // TRAZABILIDAD: Generar lote automáticamente si no existe
  let lotId = lot_id;
  
  if (!lotId) {
    try {
      // Generar número de lote automático - safe fallbacks if route not present
      let lotNumber = 'LOT-' + Date.now().toString().slice(-8);
      try {
        const base = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_API_URL : '';
        if (base) {
          const lotNumberResponse = await fetch(`${base}/api/lots/generate-next`);
          if (lotNumberResponse.ok) {
            const parsed = await lotNumberResponse.json();
            if (parsed && parsed.lotNumber) lotNumber = parsed.lotNumber;
          }
        }
      } catch(_) {}
      
      // Crear nuevo lote en la tabla maestra
      const newLot = await sql`
        INSERT INTO lots (
          lot_number,
          producer,
          orchard_name,
          origin,
          location,
          fruit_type,
          date,
          status,
          destination,
          client_name,
          lot_traceability_status,
          visit_id,
          cutting_order_id
        ) VALUES (
          ${lotNumber},
          ${producer_name},
          ${orchard_name},
          ${location || ''},
          ${location || ''},
          'aguacate',
          ${cutting_date},
          'cutting',
          ${destination || ''},
          ${client_name || ''},
          'active',
          ${body.visit_id || null},
          null
        )
        RETURNING *
      `;
      
      lotId = newLot[0].id;
    } catch (eLot) {
      console.error('Auto lote create fallback (tolerated):', eLot.message);
      // proceed without lote
      lotId = null;
    }
  }
  
  let batchId = master_batch_id;
  
  // If no master_batch_id provided but lot_id exists, find or create batch
  if (!batchId && lotId) {
    const existingBatch = await sql`
      SELECT id FROM master_batches 
      WHERE lot_id = ${lotId} 
      AND status IN ('received', 'processing')
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (existingBatch.length > 0) {
      batchId = existingBatch[0].id;
      
      // Update batch status to processing
      await sql`
        UPDATE master_batches
        SET status = 'processing', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${batchId}
      `;
    }
  }
  
  const costF = (freight_cost !== undefined && freight_cost !== null ) ? parseFloat(freight_cost) : 0;
  const result = await sql`
    INSERT INTO cutting_orders (
      folio,
      cutting_date,
      producer_name,
      orchard_name,
      location,
      scale,
      meeting_point,
      truck_plates,
      truck_type,
      freight_cost,
      driver_name,
      crew_chief_name,
      crew_payment_method,
      crew_workers_count,
      boxes_count,
      lot_id,
      master_batch_id,
      status,
      crew_chief_phone,
      driver_phone,
      contact_name,
      contact_phone,
      meeting_time,
      orchard_plant_type,
      orchard_terrain_type,
      orchard_cutting_type,
      orchard_specifications,
      packing_house_address,
      broker_name,
      agreed_commission,
      agreed_price_per_kg,
      show_agreed_price,
      plazo_dias,
      tipo_dias,
      entrega_estimada,
      visit_id,
      calculator_evaluation_id
    )
    VALUES (
      ${folio},
      ${cutting_date},
      ${producer_name},
      ${orchard_name},
      ${location},
      ${scale},
      ${meeting_point},
      ${truck_plates},
      ${truck_type},
      ${costF},
      ${driver_name},
      ${crew_chief_name},
      ${crew_payment_method || 'kilos'},
      ${crew_workers_count},
      ${boxes_count},
      ${lotId || null},
      ${batchId || null},
      'authorized',
      ${crew_chief_phone || null},
      ${driver_phone || null},
      ${contact_name || null},
      ${contact_phone || null},
      ${meeting_time || null},
      ${orchard_plant_type || null},
      ${orchard_terrain_type || null},
      ${orchard_cutting_type || null},
      ${orchard_specifications || null},
      ${packing_house_address || null},
      ${broker_name || null},
      ${agreed_commission || null},
      ${agreed_price_per_kg || null},
      ${show_agreed_price === true || show_agreed_price === 'true'},
      ${plazo_dias ? parseInt(plazo_dias) : 0},
      ${tipo_dias || 'habiles'},
      ${entrega_estimada || null},
      ${body.visit_id || null},
      ${body.calculator_evaluation_id || null}
    )
    RETURNING *
  `;
  
  // Obtener información del lote creado
  const lotInfo = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
  // Log traceability event
  await sql`
    INSERT INTO traceability_log (
      master_batch_id,
      lot_id,
      event_type,
      event_category,
      event_description,
      related_entity_type,
      related_entity_id,
      user_id,
      user_name,
      metadata
    )
    VALUES (
      ${batchId || null},
      ${lotId || null},
      'cutting_order_created',
      'cutting',
      ${`Cutting order ${folio} created - ${boxes_count} boxes`},
      'cutting_order',
      ${result[0].id},
      ${user_id || null},
      ${user_name || null},
      ${JSON.stringify({
        folio,
        cutting_date,
        producer_name,
        orchard_name,
        boxes_count,
        crew_chief_name,
        crew_workers_count
      })}
    )
  `;

  // INTEGRACIÓN AUTOMÁTICA: Costo de Flete => Cuadrillas y Fletes (crew_freights) + evitar duplicados
  try {
    const costo = parseFloat(costF || 0);
    if (costo >= 0) {
      // Calcular semana (lunes-domingo) del cutting_date
      const cd = new Date(cutting_date);
      const dayOfWeek = cd.getUTCDay();
      const diff = cd.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mon = new Date(cd); mon.setUTCDate(diff); mon.setUTCHours(0,0,0,0);
      const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
      const ws = mon.toISOString().split('T')[0];
      const we = sun.toISOString().split('T')[0];

      // Buscar o crear cierre de semana para cuadrillas
      let weekClosing = await sql`SELECT id FROM crew_weekly_closings WHERE week_start_date = ${ws} AND week_end_date = ${we} LIMIT 1`;
      if (weekClosing.length === 0) {
        const [nc] = await sql`
          INSERT INTO crew_weekly_closings (week_start_date, week_end_date, status)
          VALUES (${ws}, ${we}, 'abierto') RETURNING id
        `;
        weekClosing = [nc];
      }
      const wcId = weekClosing[0].id;

      // No duplicar flete para misma orden
      const existingF = await sql`SELECT id FROM crew_freights WHERE cutting_order_id = ${result[0].id} LIMIT 1`;
      if (!existingF.length && costo > 0) {
        await sql`
          INSERT INTO crew_freights (week_closing_id, cutting_order_id, lot_id, freight_type, description, price, freight_date, notes)
          VALUES (${wcId}, ${result[0].id}, ${lotId || null}, 'corte', ${'Flete automático por Orden: ' + folio}, ${costo}, ${cutting_date}, 'Generado automáticamente al guardar la Orden de Corte')
        `;
      }
    }
  } catch (e) {
    console.error('Auto-flete error (non-blocking):', e.message);
  }

  // AUTO_SYNC: Asignar cajas a Control de Caja emitiendo ticket de forma automática (idempotente: una sola salida por orden)
  if (parseInt(boxes_count || 0) > 0) {
    try {
      // Idempotency: no duplicar salida para la misma orden de corte
      const existingSalida = await sql`
        SELECT id FROM box_control_movements 
        WHERE cutting_order_id = ${result[0].id} 
          AND movement_type = 'SALIDA A CAMPO' 
        LIMIT 1
      `;
      if (!existingSalida.length) {
        const ts = Date.now();
        const folioSal = `SAL-CORTE-${new Date().getFullYear()}-${ts.toString().slice(-8)}`;
        const [mov] = await sql`
          INSERT INTO box_control_movements (
            folio, cutting_order_id, lot_id, operational_state, movement_type,
            movement_date, location, boxes_quantity, responsible_type, responsible_name, responsible_phone,
            notes, status, created_by
          ) VALUES (
            ${folioSal}, ${result[0].id || null}, ${lotId || null}, 'EN CORTE', 'SALIDA A CAMPO',
            CURRENT_TIMESTAMP, 'CAMPO',
            ${parseInt(boxes_count)},
            'Fletero/Cuadrilla', ${driver_name || crew_chief_name || 'Sin responsable'},
            ${driver_phone || crew_chief_phone || null},
            ${'Automático al emitir Orden de Corte ' + folio + ' | ' + (producer_name||'') + ' | ' + (orchard_name||'') },
            'active', 'sistema'
          ) RETURNING *
        `;
        await sql`
          INSERT INTO box_movement_history (movement_id, event_type, event_date, to_state, to_responsible_name, to_location, user_name, related_document_type, related_document_id, notes)
          VALUES (${mov.id}, 'SALIDA A CAMPO', CURRENT_TIMESTAMP, 'EN CORTE', ${driver_name || crew_chief_name}, 'CAMPO', 'Sistema (Órdenes de Corte)', 'cutting_order', ${result[0].id || null}, 'Ticket generado automático junto con la orden')
        `;
      }
    } catch (e) { console.error('Auto box salida non-blocking:', e && e.message); }
  }

  // Retornar la orden con información del lote
  const orderWithLot = {
    ...result[0],
    lot_info: lotInfo[0]
  };

  // Asegurar enlace bidireccional fuerte (lote → cutting + cutting → lote)
  if (lotId) {
    try { await sql`UPDATE lots SET cutting_order_id = ${result[0].id}, visit_id = COALESCE(visit_id, ${body.visit_id || null}), updated_at = NOW() WHERE id = ${lotId}`; } catch(_) {}
  }

  // AUTO CREAR OBLIGACIÓN AL PRODUCTOR (payment_schedule) - fuente única, usa algoritmo oficial de viernes
  // Reserva al crear (AUTORIZAR): no declara fruta recibida definitiva ni pago hasta complete
  try {
    const precio = parseFloat(agreed_price_per_kg || 0);
    // Al autorizar usamos estimado si no hay net aún; el complete con kg real recalculará/actualizará
    const kgEst = parseFloat(result[0].net_weight || result[0].gross_weight || 0) || (parseFloat(boxes_count||0) * 10); // fallback estimado
    const importe = precio > 0 && kgEst > 0 ? Math.round(precio * kgEst * 100) / 100 : 0;

    if (importe > 0 && producer_name && cutting_date) {
      // Dup check por cutting_order_id (único) + producer
      const existingPay = await sql`
        SELECT id FROM payment_schedule 
        WHERE cutting_order_id = ${result[0].id} OR (producer_name = ${producer_name} AND fruit_reception_date = ${cutting_date})
        LIMIT 1
      `;
      if (!existingPay.length) {
        // Delegar al motor oficial de calendario (import dinámico para reutilizar)
        let scheduleCalc;
        try {
          const psMod = await import('../payment-schedule/route.js');
          scheduleCalc = await psMod.computePaymentSchedule(cutting_date, (plazo_dias||7), result[0].id);
        } catch (_) {
          // fallback simple
          const dias = plazo_dias ? parseInt(plazo_dias) : 7;
          const receptionDate = new Date(cutting_date);
          const due = new Date(receptionDate); due.setDate(due.getDate() + dias);
          const day = due.getDay();
          const diff = day <= 5 ? 5 - day : 7 - day + 5;
          const scheduled = new Date(due); scheduled.setDate(scheduled.getDate() + diff);
          scheduleCalc = { scheduled_payment_date: scheduled.toISOString().slice(0,10), contractual_due_date: due.toISOString().slice(0,10), original_friday: scheduled.toISOString().slice(0,10), adjustment_reason: '', calendar_version: 'V3-fallback', fruit_reception_date: cutting_date, payment_days: dias };
        }

        const year = new Date().getFullYear();
        const last = await sql`SELECT folio FROM payment_schedule WHERE folio LIKE ${'PAG-' + year + '-%'} ORDER BY id DESC LIMIT 1`;
        let nextN = 1;
        if (last.length) {
          const n = parseInt(String(last[0].folio).split('-')[2] || '0');
          nextN = n + 1;
        }
        const pfolio = `PAG-${year}-${String(nextN).padStart(3,'0')}`;

        await sql`
          INSERT INTO payment_schedule (
            folio, producer_name, beneficiary_name, concept, amount,
            fruit_reception_date, due_date, scheduled_payment_date,
            payment_days, priority, status, created_by, cutting_order_id,
            contractual_due_date, original_friday, adjustment_reason, calendar_version,
            monto_pagado, saldo_pendiente
          ) VALUES (
            ${pfolio}, ${producer_name}, ${producer_name}, 
            ${'Fruta - Orden ' + (folio || result[0].folio)},
            ${importe}, ${cutting_date}, ${scheduleCalc.scheduled_payment_date || cutting_date}, ${scheduleCalc.scheduled_payment_date || cutting_date},
            ${scheduleCalc.payment_days || (plazo_dias||7)}, 'normal', 'scheduled', 'sistema-orden-corte', ${result[0].id},
            ${scheduleCalc.contractual_due_date || null}, ${scheduleCalc.original_friday || null}, ${scheduleCalc.adjustment_reason || ''}, ${scheduleCalc.calendar_version || 'V3'},
            0, ${importe}
          )
        `;
      }
    }
  } catch (ePay) {
    console.error('Auto payment_schedule sync (non-blocking):', ePay?.message);
  }

  return NextResponse.json(orderWithLot);
}

// PUT: update e.g. link lot_id to the order (for complete traceability from ingreso de fruta)
export async function PUT(request) {
  try {
    const { 
      id, 
      lot_id, 
      net_weight, 
      status, 
      plazo_dias,
      tipo_dias,
      entrega_estimada,
      freight_cost,
      show_agreed_price,
      ...other 
    } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    const costF = (freight_cost !== undefined && freight_cost !== null) ? parseFloat(freight_cost) : undefined;

    // Allow generic other fields
    const allowed = ['crew_payment_method', 'crew_workers_count', 'notes', 'driver_name', 'crew_chief_name', 'truck_type', 'truck_plates'];
    
    // Build dynamic update values
    const [updated] = await sql`
      UPDATE cutting_orders SET 
        lot_id = COALESCE(${lot_id !== undefined ? lot_id : null}, lot_id),
        net_weight = COALESCE(${net_weight != null ? parseFloat(net_weight) : null}, net_weight),
        status = COALESCE(${status}, status),
        plazo_dias = COALESCE(${plazo_dias != null ? parseInt(plazo_dias) : null}, plazo_dias),
        tipo_dias = COALESCE(${tipo_dias}, tipo_dias),
        entrega_estimada = COALESCE(${entrega_estimada !== undefined ? entrega_estimada : null}, entrega_estimada),
        freight_cost = COALESCE(${costF !== undefined ? costF : null}, freight_cost),
        show_agreed_price = COALESCE(${show_agreed_price !== undefined ? show_agreed_price : null}, show_agreed_price),
        updated_at = NOW()
      WHERE id = ${id} 
      RETURNING *
    `;

    // sync if needed on lot too
    if (lot_id && updated) {
      await sql`UPDATE lots SET cutting_order_id = ${id} WHERE id = ${lot_id}`;
    }

    // Si hay costo flete actualizado y >0 , asegurar registro en crew_freights (sin duplicados)
    try {
      if (costF !== undefined && costF >= 0) {
        const exs = await sql`SELECT id FROM crew_freights WHERE cutting_order_id = ${id} LIMIT 1`;
        if (!exs.length && costF > 0) {
          const orc = await sql`SELECT cutting_date, folio, lot_id FROM cutting_orders WHERE id=${id} LIMIT 1`;
          const o = orc[0] || {};
          const cd = o.cutting_date || new Date();
          const dayOfWeek = new Date(cd).getUTCDay();
          const dff = new Date(cd).getUTCDate() - dayOfWeek + (dayOfWeek===0?-6:1);
          const m = new Date(cd); m.setUTCDate(dff); m.setUTCHours(0,0,0,0);
          const s = new Date(m); s.setUTCDate(m.getUTCDate()+6);
          const ws=m.toISOString().split('T')[0], we=s.toISOString().split('T')[0];
          let wc = await sql`SELECT id FROM crew_weekly_closings WHERE week_start_date=${ws} AND week_end_date=${we} LIMIT 1`;
          if (!wc.length) {
            const [n] = await sql`INSERT INTO crew_weekly_closings(week_start_date,week_end_date,status) VALUES(${ws},${we},'abierto') RETURNING id`;
            wc=[n];
          }
          await sql`
            INSERT INTO crew_freights (week_closing_id, cutting_order_id, lot_id, freight_type, description, price, freight_date, notes)
            VALUES (${wc[0].id}, ${id}, ${o.lot_id||null}, 'corte', ${'Flete desde edición Orden ' + (o.folio||id)}, ${costF}, ${o.cutting_date||new Date()}, 'Edición/Actualización de costo')
          `;
        }
      }
    } catch(_) {}

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating cutting order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}