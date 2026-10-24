import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { recalculateLotPerformance } from "@/app/api/utils/recalculate";
import * as CrewService from "@/lib/domain/crew-service";

export async function POST(request) {
  try {
    const { order_id, net_weight, returned_boxes, missing_boxes, damaged_boxes } = await request.json();
    
    if (!order_id || !net_weight) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    
    // 1. Obtener información de la orden de corte
    const [order] = await sql`
      SELECT * FROM cutting_orders WHERE id = ${order_id}
    `;
    
    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    
    if (order.status === 'completed') {
      return NextResponse.json({ error: 'Esta orden ya fue completada' }, { status: 400 });
    }
    
    // 2. Actualizar la orden de corte con el peso neto y cajas
    await sql`
      UPDATE cutting_orders
      SET 
        net_weight = ${net_weight},
        returned_boxes = ${returned_boxes || 0},
        missing_boxes = ${missing_boxes || 0},
        status = 'completed'
      WHERE id = ${order_id}
    `;
    
    // 3. Si hay lote asociado, crear/actualizar registro de ingreso (SIN += para mantener fuente única)
    if (order.lot_id) {
      const existingWeighing = await sql`
        SELECT id FROM fruit_input_weighings 
        WHERE lot_id = ${order.lot_id}
      `;
      
      if (existingWeighing.length === 0) {
        await sql`
          INSERT INTO fruit_input_weighings (
            lot_id, master_batch_id, total_kg_weighed, public_scale_date, notes
          )
          VALUES (
            ${order.lot_id}, ${order.master_batch_id || null}, ${net_weight}, ${order.cutting_date},
            ${`Ingreso automático desde orden de corte ${order.folio}`}
          )
        `;
      } else {
        // Set (no add) the validated value if this is the authoritative reception
        await sql`
          UPDATE fruit_input_weighings
          SET total_kg_weighed = ${net_weight},
              notes = COALESCE(notes, '') || ' | ' || ${`Actualizado desde orden ${order.folio}`}
          WHERE lot_id = ${order.lot_id}
        `;
      }
      
      if (order.broker_name || order.agreed_commission || order.agreed_price_per_kg) {
        if (order.broker_name) await sql`UPDATE lots SET broker_name = ${order.broker_name} WHERE id = ${order.lot_id}`;
        if (order.agreed_price_per_kg) await sql`UPDATE lots SET fruit_price = ${order.agreed_price_per_kg} WHERE id = ${order.lot_id}`;
        if (order.agreed_commission) await sql`UPDATE lots SET commission_amount = ${order.agreed_commission} WHERE id = ${order.lot_id}`;
      }
    }
    
    // 4. Calcular el pago de la cuadrilla usando servicio de dominio (congela tarifa)
    // FASE 03 BLOQUE 02: aplica regla de volumen (5000kg) - fuente única cutting_orders
    const defaultRate = await CrewService.getDefaultCrewRate();
    const appliedRate = parseFloat(order.applied_crew_rate || defaultRate);
    // Enforce volume rule for new/updated (historical preserved)
    const enforcedMethod = CrewService.getCrewPaymentMethodByVolume ? CrewService.getCrewPaymentMethodByVolume(net_weight) : (order.crew_payment_method || 'kilos');
    const paymentAmount = CrewService.calculateCrewPay({
      kg: net_weight,
      rate: appliedRate
    });

    // Congelar tarifa y kg en la orden (single source) + método por regla
    await sql`
      UPDATE cutting_orders 
      SET 
        applied_crew_rate = ${appliedRate},
        kg_original = COALESCE(kg_original, net_weight),
        payable_kg = ${net_weight},
        crew_payment_method = ${enforcedMethod},
        applied_freight_amount = COALESCE(applied_freight_amount, freight_cost),
        updated_at = NOW()
      WHERE id = ${order_id}
    `;
    
    // 5. Buscar o crear cierre semanal para la fecha de corte
    const cuttingDate = new Date(order.cutting_date);
    
    // Encontrar el lunes de la semana
    const dayOfWeek = cuttingDate.getDay();
    const diff = cuttingDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(cuttingDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    // Calcular domingo (fin de semana)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];
    
    // Buscar cierre semanal existente
    let weekClosing = await sql`
      SELECT id FROM crew_weekly_closings
      WHERE week_start_date = ${weekStart}
      AND week_end_date = ${weekEnd}
    `;
    
    // Si no existe, crear uno nuevo
    if (weekClosing.length === 0) {
      const [newClosing] = await sql`
        INSERT INTO crew_weekly_closings (
          week_start_date,
          week_end_date,
          status
        )
        VALUES (${weekStart}, ${weekEnd}, 'abierto')
        RETURNING id
      `;
      weekClosing = [newClosing];
    }
    
    // 6. Actualizar el cierre semanal general con el gasto de nómina
    const closingId = weekClosing[0].id;
    
    // Buscar el cierre semanal general correspondiente
    const generalClosing = await sql`
      SELECT id FROM weekly_closings
      WHERE week_start_date = ${weekStart}
      AND week_end_date = ${weekEnd}
    `;
    
    if (generalClosing.length > 0) {
      // Actualizar el gasto de nómina en el cierre semanal general
      await sql`
        UPDATE weekly_closings
        SET 
          total_cuadrilla_dinero = COALESCE(total_cuadrilla_dinero, 0) + ${paymentAmount},
          total_cuadrilla_kg = COALESCE(total_cuadrilla_kg, 0) + ${net_weight},
          nomina_semanal = COALESCE(nomina_semanal, 0) + ${paymentAmount},
          total_egresos_dinero = COALESCE(total_egresos_dinero, 0) + ${paymentAmount},
          resultado_dinero = COALESCE(total_ingresos_dinero, 0) - (COALESCE(total_egresos_dinero, 0) + ${paymentAmount})
        WHERE id = ${generalClosing[0].id}
      `;
    } else {
      // Si no existe cierre general, crearlo
      await sql`
        INSERT INTO weekly_closings (
          week_start_date,
          week_end_date,
          total_cuadrilla_dinero,
          total_cuadrilla_kg,
          nomina_semanal,
          total_egresos_dinero,
          status
        )
        VALUES (
          ${weekStart},
          ${weekEnd},
          ${paymentAmount},
          ${net_weight},
          ${paymentAmount},
          ${paymentAmount},
          'abierto'
        )
      `;
    }
    
    // CENTRAL SYNC + TRAZABILIDAD (use canonical recalc, no += on total_kg_received)
    if (order.lot_id) {
      try {
        await sql`UPDATE lots SET cutting_order_id = ${order_id}, updated_at = NOW() WHERE id = ${order.lot_id}`;
        const { recalculateLot } = await import('@/app/api/utils/recalculate');
        await recalculateLot(order.lot_id);
        await recalculateLotPerformance(order.lot_id);
      } catch (_) {}
    }

    // Propagate status to linked visit (huerta → corte flow)
    if (order.visit_id) {
      try {
        await sql`UPDATE orchard_visits SET neg_status = 'Cortada', updated_at = NOW() WHERE id = ${order.visit_id}`;
      } catch (_) {}
    }

    // Auto penalizaciones por cajas faltantes / no retornadas + daños (BLOCK 04 trazabilidad física sanciones autorizadas)
    const missing = parseInt(missing_boxes || 0) + (parseInt(order.boxes_count || 0) - parseInt(returned_boxes || order.boxes_count || 0));
    if (missing > 0 && order.lot_id) {
      const penalty = missing * 100;
      try {
        await sql`
          INSERT INTO payroll_deductions (deduction_type, employee_name, concept, amount, deduction_date, week_start_date, week_end_date, status, notes)
          VALUES 
            ('cajas_perdidas', ${order.driver_name || 'Fletero'}, ${'Cajas faltantes Orden ' + order.folio}, ${Math.ceil(penalty/2)}, CURRENT_DATE, ${weekStart}, ${weekEnd}, 'pendiente', ${'Folio corte: ' + order.folio}),
            ('cajas_perdidas', ${order.crew_chief_name || 'Jefe Cuadrilla'}, ${'Cajas faltantes Orden ' + order.folio}, ${Math.ceil(penalty/2)}, CURRENT_DATE, ${weekStart}, ${weekEnd}, 'pendiente', ${'Folio corte: ' + order.folio})
        `;
        // Log central
        await sql`
          INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, module, reference, notes, created_at)
          VALUES ('cutting_order', ${order_id}, ${order.lot_id}, 'PENALIZACION_CAJAS', ${order.boxes_count||0}, ${missing}, ${missing}, 'cajas', 'caja-campo', ${order.folio}, ${'Penalización auto $100 x caja - ' + missing + ' cajas'})
        `;
      } catch (_) {}
    }

    // Registrar daños explícitos si se proveen (sanciones)
    if (damaged_boxes && parseInt(damaged_boxes) > 0) {
      try {
        const dmg = parseInt(damaged_boxes);
        await sql`
          INSERT INTO box_control_incidents (cutting_order_id, lot_id, incident_type, severity, boxes_expected, boxes_received, boxes_difference, status, penalty_amount, penalty_applied, title, description)
          VALUES (${order_id}, ${order.lot_id}, 'DAÑO', 'media', ${order.boxes_count||0}, ${returned_boxes||0}, ${dmg}, 'open', ${dmg*50}, true, 'Daño en recepción', ${'Daños reportados en completado orden ' + order.folio})
        `;
      } catch(_) {}
    }

    // Ensure box_control also reflects final return state
    try {
      if (order.id) {
        await sql`
          UPDATE box_control_movements 
          SET operational_state = 'RECIBIDA EN EMPAQUE', cajas_vacias = ${parseInt(returned_boxes||0)}, cajas_extraviadas = ${parseInt(missing_boxes||0)},
              notes = COALESCE(notes,'') || ' | COMPLETADA ORDEN ' + ${order.folio}
          WHERE cutting_order_id = ${order_id} AND operational_state ILIKE '%CORTE%' OR operational_state = 'EN CORTE'
          LIMIT 1
        `;
      }
    } catch (_) {}

    return NextResponse.json({ 
      success: true, 
      message: 'Orden completada exitosamente',
      payment_calculated: paymentAmount,
      weight_recorded: net_weight
    });
    
  } catch (error) {
    console.error('Error completing cutting order:', error);
    return NextResponse.json({ 
      error: 'Error al completar la orden',
      details: error.message 
    }, { status: 500 });
  }
}
