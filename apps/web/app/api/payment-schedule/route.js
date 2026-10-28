import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// === ALGORITMO OBLIGATORIO VIERNES (Bloque 19) - America/Mexico_City natural days ===
// contractual = fecha_corte + plazo NATURAL (días calendario)
// A) Lun/Mar -> viernes MISMA semana
// B) Mie-Dom -> viernes SEMANA SIGUIENTE
// C) Si viernes calculado es festivo -> siguiente viernes no festivo (repetir)
// D) Guardar: fecha_corte, plazo, vencimiento_contractual, viernes_original, viernes_efectivo, razon, version
// E) NO mover silenciosamente órdenes ya vencidas al futuro

function toDateOnly(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toISOString().split('T')[0];
}

function getWeekMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00-06:00');
  const day = d.getDay();
  const diff = (day === 0) ? -6 : (1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadActiveHolidays(year) {
  try {
    const rows = await sql`
      SELECT holiday_date FROM corporate_holidays 
      WHERE year = ${year} AND is_active = true
    `;
    return rows.map(r => toDateOnly(r.holiday_date));
  } catch {
    return [];
  }
}

function calcularDiasRetrasoHabiles(scheduledStr, refDateStr = null, isLiquidated = false) {
  if (!scheduledStr) return 0;
  const scheduled = new Date(scheduledStr + 'T12:00:00');
  let ref = refDateStr ? new Date(refDateStr + 'T12:00:00') : new Date();
  if (ref <= scheduled) return 0;
  // count from NEXT day after scheduled, only Mon-Fri, include today if pending
  let d = new Date(scheduled);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);
  let count = 0;
  while (d <= ref) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++; // Mon-Fri only; NO holidays subtracted per spec
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function computePaymentSchedule(fruitReceptionDateStr, paymentDays, cuttingOrderId = null) {
  if (!fruitReceptionDateStr) {
    const today = new Date();
    fruitReceptionDateStr = toDateOnly(today);
  }
  const reception = new Date(fruitReceptionDateStr + 'T12:00:00-06:00');
  const plazo = parseInt(paymentDays) || 0;

  // Vencimiento contractual (fecha_corte + plazo natural)
  const contractual = new Date(reception);
  contractual.setDate(contractual.getDate() + plazo);
  const contractualStr = toDateOnly(contractual);

  const dow = contractual.getDay(); // 0=Dom,1=Lun,...5=Vie,6=Sab
  const weekMon = getWeekMonday(contractualStr);

  let originalFriday;
  if (dow === 1 || dow === 2) {
    // A) viernes de la MISMA semana
    originalFriday = new Date(weekMon);
    originalFriday.setDate(originalFriday.getDate() + 4);
  } else {
    // B) viernes de la SEMANA SIGUIENTE
    originalFriday = new Date(weekMon);
    originalFriday.setDate(originalFriday.getDate() + 4 + 7);
  }

  const originalFridayStr = toDateOnly(originalFriday);
  const year = originalFriday.getFullYear();
  const holidayDates = await loadActiveHolidays(year);

  // C) Ajuste por festivos (repetir hasta viernes no festivo)
  let effective = new Date(originalFriday);
  let reason = '';
  let iter = 0;
  const maxIter = 12;
  while (iter < maxIter) {
    const effStr = toDateOnly(effective);
    if (!holidayDates.includes(effStr)) break;
    effective.setDate(effective.getDate() + 7);
    reason = 'Festivo según calendario corporativo vigente';
    iter++;
  }
  if (iter >= maxIter) reason += ' (límite de ajustes)';

  const effectiveStr = toDateOnly(effective);

  // D) Si ya vencida al capturar, NO mover al futuro silenciosamente
  const todayStr = toDateOnly(new Date());
  const isOverdueCapture = contractualStr < todayStr;

  return {
    fruit_reception_date: fruitReceptionDateStr,
    payment_days: plazo,
    due_date: contractualStr,                 // contractual
    contractual_due_date: contractualStr,
    scheduled_payment_date: effectiveStr,
    original_friday: originalFridayStr,
    adjustment_reason: reason,
    calendar_version: 'V3-2026',
    cutting_order_id: cuttingOrderId || null,
    is_overdue_capture: isOverdueCapture
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const urgent = searchParams.get("urgent");
    const id = searchParams.get("id");
    const week = searchParams.get("week"); // this | next | prev | overdue
    const producerFilter = searchParams.get("producer");
    const orderFilter = searchParams.get("order");
    const minAtraso = searchParams.get("minAtraso");
    const statusFilter = searchParams.get("statusFilter");

    if (id) {
      const payment = await sql`
        SELECT * FROM payment_schedule
        WHERE id = ${parseInt(id)}
      `;
      return NextResponse.json(payment[0] || null);
    }

    let where = sql``;
    const conditions = [];

    if (status) {
      conditions.push(sql`status = ${status}`);
    }

    if (month && year) {
      conditions.push(
        sql`EXTRACT(MONTH FROM scheduled_payment_date) = ${parseInt(month)} AND EXTRACT(YEAR FROM scheduled_payment_date) = ${parseInt(year)}`
      );
    }

    if (urgent === 'true') {
      // Payments with 13 days or less until due date
      const today = new Date().toISOString().split('T')[0];
      conditions.push(sql`(due_date - DATE ${today}) <= 13 AND status = 'scheduled'`);
    }

    if (producerFilter) {
      conditions.push(sql`producer_name ILIKE ${'%' + producerFilter + '%'} `);
    }
    if (orderFilter) {
      conditions.push(sql`cutting_order_id = ${parseInt(orderFilter) || 0}`);
    }
    if (statusFilter) {
      conditions.push(sql`status = ${statusFilter}`);
    }
    if (minAtraso) {
      // client will filter further on dias; here for future
    }

    // Week grouping support for P3 dashboard (Mon-Sun administrative week)
    if (week) {
      const now = new Date();
      const dow = now.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      let mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      if (week === 'next') mon.setDate(mon.getDate() + 7);
      if (week === 'prev') mon.setDate(mon.getDate() - 7);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      const start = mon.toISOString().split('T')[0];
      const end = sun.toISOString().split('T')[0];
      if (week === 'overdue') {
        conditions.push(sql`scheduled_payment_date < ${start} AND (saldo_pendiente > 0 OR status NOT IN ('paid'))`);
      } else {
        conditions.push(sql`scheduled_payment_date >= ${start} AND scheduled_payment_date <= ${end}`);
      }
    }

    if (conditions.length > 0) {
      where = sql`WHERE ${conditions[0]}`;
      for (let i = 1; i < conditions.length; i++) {
        where = sql`${where} AND ${conditions[i]}`;
      }
    }

    const payments = await sql`
      SELECT ps.*, co.folio AS corte_folio, co.broker_name AS corredor
      FROM payment_schedule ps
      LEFT JOIN cutting_orders co ON ps.cutting_order_id = co.id
      ${where}
      ORDER BY scheduled_payment_date ASC, priority DESC
    `;

    const enriched = payments.map(p => {
      const isLiquid = (p.status === 'paid' || (p.monto_pagado || 0) >= (p.amount || 0));
      const refDate = isLiquid && p.paid_at ? p.paid_at.split('T')[0] : (p.fecha_liquidacion ? p.fecha_liquidacion.split('T')[0] : null);
      const dias = calcularDiasRetrasoHabiles(p.scheduled_payment_date, refDate, isLiquid);
      const pagado = parseFloat(p.monto_pagado || 0);
      const saldo = (p.saldo_pendiente != null) ? parseFloat(p.saldo_pendiente) : Math.max(0, parseFloat(p.amount || 0) - pagado);
      return {
        ...p,
        dias_retraso_habiles: dias,
        monto_pagado: pagado,
        saldo_pendiente: saldo,
        status: (saldo <= 0 && (pagado > 0 || p.status === 'paid')) ? 'paid' : (pagado > 0 ? 'partial' : (p.status || 'scheduled'))
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching payment schedule:", error);
    return NextResponse.json(
      { error: "Error al obtener programación de pagos" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    const {
      producer_name,
      beneficiary_name,
      bank_name,
      account_number,
      clabe,
      concept,
      amount,
      payment_days,
      fruit_reception_date,
      priority,
      invoice_number,
      invoice_file_url,
      rfc,
      observations,
      created_by,
      cutting_order_id
    } = data;

    // NUEVO: usar algoritmo V3 contractual + viernes + festivos + Mexico City
    const schedule = await computePaymentSchedule(fruit_reception_date, payment_days, cutting_order_id);

    // Generate folio
    const year = new Date().getFullYear();
    const lastPayment = await sql`
      SELECT folio FROM payment_schedule
      WHERE folio LIKE ${'PAG-' + year + '-%'}
      ORDER BY id DESC
      LIMIT 1
    `;

    let nextNumber = 1;
    if (lastPayment.length > 0) {
      const lastFolio = lastPayment[0].folio;
      const lastNumber = parseInt(lastFolio.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const folio = `PAG-${year}-${String(nextNumber).padStart(3, '0')}`;

    const result = await sql`
      INSERT INTO payment_schedule (
        folio,
        producer_name,
        beneficiary_name,
        bank_name,
        account_number,
        clabe,
        concept,
        amount,
        due_date,
        scheduled_payment_date,
        payment_days,
        fruit_reception_date,
        priority,
        invoice_number,
        invoice_file_url,
        rfc,
        observations,
        status,
        created_by,
        cutting_order_id,
        contractual_due_date,
        original_friday,
        adjustment_reason,
        calendar_version,
        monto_pagado,
        saldo_pendiente,
        bank_account_id,
        owner_type
      ) VALUES (
        ${folio},
        ${producer_name},
        ${beneficiary_name},
        ${bank_name || null},
        ${account_number || null},
        ${clabe || null},
        ${concept},
        ${amount},
        ${schedule.contractual_due_date},
        ${schedule.scheduled_payment_date},
        ${schedule.payment_days},
        ${schedule.fruit_reception_date},
        ${priority || 'normal'},
        ${invoice_number || null},
        ${invoice_file_url || null},
        ${rfc || null},
        ${observations || null},
        'scheduled',
        ${created_by || 'system'},
        ${schedule.cutting_order_id},
        ${schedule.contractual_due_date},
        ${schedule.original_friday},
        ${schedule.adjustment_reason},
        ${schedule.calendar_version},
        0,
        ${parseFloat(amount)},
        ${data.bank_account_id || null},
        ${data.owner_type || 'producer'}
      )
      RETURNING *
    `;

    // Create audit log
    await sql`
      INSERT INTO payment_schedule_audit (
        payment_id,
        action,
        user_name,
        new_data,
        reason,
        timestamp
      ) VALUES (
        ${result[0].id},
        'created',
        ${created_by || 'system'},
        ${JSON.stringify(result[0])},
        'Pago programado creado',
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating payment schedule:", error);
    return NextResponse.json(
      { error: "Error al crear programación de pago" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json(
        { error: "ID es requerido" },
        { status: 400 }
      );
    }

    // Get current data for audit
    const current = await sql`
      SELECT * FROM payment_schedule
      WHERE id = ${id}
    `;

    if (current.length === 0) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'updated_by') {
        updates.push(key);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      return NextResponse.json(current[0]);
    }

    // Recalculate ONLY if authorized data changed (payment_days o fecha_recepcion) - respeta histórico
    if (updateData.payment_days !== undefined || updateData.fruit_reception_date !== undefined) {
      const schedule = await computePaymentSchedule(
        updateData.fruit_reception_date || current[0].fruit_reception_date,
        updateData.payment_days !== undefined ? updateData.payment_days : current[0].payment_days,
        updateData.cutting_order_id || current[0].cutting_order_id
      );
      updateData.due_date = schedule.contractual_due_date;
      updateData.scheduled_payment_date = schedule.scheduled_payment_date;
      updateData.contractual_due_date = schedule.contractual_due_date;
      updateData.original_friday = schedule.original_friday;
      updateData.adjustment_reason = schedule.adjustment_reason;
      updateData.calendar_version = schedule.calendar_version;
    }

    // Handle partial payments / liquidacion for dias_retraso (P2)
    // Idempotencia por referencia/comprobante: si ya hay pago con misma ref + monto similar, no suma de nuevo.
    const newMontoPagadoInput = updateData.monto_pagado !== undefined ? parseFloat(updateData.monto_pagado) : null;
    const totalAmount = updateData.amount !== undefined ? parseFloat(updateData.amount) : parseFloat(current[0].amount || 0);
    let newMontoPagado = parseFloat(current[0].monto_pagado || 0);
    let newSaldo = (current[0].saldo_pendiente != null) ? parseFloat(current[0].saldo_pendiente) : Math.max(0, totalAmount - newMontoPagado);

    const ref = updateData.payment_proof_url || updateData.observations || updateData.referencia || '';
    const applyAmount = newMontoPagadoInput !== null ? newMontoPagadoInput - newMontoPagado : 0;

    if (applyAmount > 0 && ref) {
      // Check duplicate application by ref + approx amount on this obligation
      const dup = await sql`
        SELECT id FROM payment_schedule_audit 
        WHERE payment_id = ${id} AND action = 'pago_aplicado' 
          AND (new_data::text ILIKE ${'%' + ref.slice(0,40) + '%'} OR reason ILIKE ${'%' + ref.slice(0,40) + '%'})
        LIMIT 1
      `;
      if (dup.length === 0) {
        newMontoPagado = Math.min(totalAmount, newMontoPagado + applyAmount);
      }
    } else if (newMontoPagadoInput !== null) {
      newMontoPagado = newMontoPagadoInput;
    }

    newSaldo = Math.max(0, totalAmount - newMontoPagado);

    if (newMontoPagadoInput !== null || updateData.status === 'paid') {
      updateData.monto_pagado = newMontoPagado;
      updateData.saldo_pendiente = newSaldo;
      if (newSaldo <= 0 || updateData.status === 'paid') {
        updateData.status = 'paid';
        if (!updateData.fecha_liquidacion && !current[0].fecha_liquidacion) {
          updateData.fecha_liquidacion = updateData.paid_at ? updateData.paid_at.split('T')[0] : new Date().toISOString().split('T')[0];
        }
      } else {
        updateData.status = 'partial';
      }
    }

    const result = await sql`
      UPDATE payment_schedule SET
        producer_name = ${updateData.producer_name !== undefined ? updateData.producer_name : current[0].producer_name},
        beneficiary_name = ${updateData.beneficiary_name !== undefined ? updateData.beneficiary_name : current[0].beneficiary_name},
        bank_name = ${updateData.bank_name !== undefined ? updateData.bank_name : current[0].bank_name},
        account_number = ${updateData.account_number !== undefined ? updateData.account_number : current[0].account_number},
        clabe = ${updateData.clabe !== undefined ? updateData.clabe : current[0].clabe},
        concept = ${updateData.concept !== undefined ? updateData.concept : current[0].concept},
        amount = ${updateData.amount !== undefined ? updateData.amount : current[0].amount},
        due_date = ${updateData.due_date !== undefined ? updateData.due_date : current[0].due_date},
        scheduled_payment_date = ${updateData.scheduled_payment_date !== undefined ? updateData.scheduled_payment_date : current[0].scheduled_payment_date},
        payment_days = ${updateData.payment_days !== undefined ? updateData.payment_days : current[0].payment_days},
        fruit_reception_date = ${updateData.fruit_reception_date !== undefined ? updateData.fruit_reception_date : current[0].fruit_reception_date},
        priority = ${updateData.priority !== undefined ? updateData.priority : current[0].priority},
        status = ${updateData.status !== undefined ? updateData.status : current[0].status},
        invoice_number = ${updateData.invoice_number !== undefined ? updateData.invoice_number : current[0].invoice_number},
        invoice_file_url = ${updateData.invoice_file_url !== undefined ? updateData.invoice_file_url : current[0].invoice_file_url},
        rfc = ${updateData.rfc !== undefined ? updateData.rfc : current[0].rfc},
        payment_proof_url = ${updateData.payment_proof_url !== undefined ? updateData.payment_proof_url : current[0].payment_proof_url},
        observations = ${updateData.observations !== undefined ? updateData.observations : current[0].observations},
        paid_at = ${updateData.paid_at !== undefined ? updateData.paid_at : current[0].paid_at},
        paid_by = ${updateData.paid_by !== undefined ? updateData.paid_by : current[0].paid_by},
        cutting_order_id = ${updateData.cutting_order_id !== undefined ? updateData.cutting_order_id : current[0].cutting_order_id},
        monto_pagado = ${updateData.monto_pagado !== undefined ? updateData.monto_pagado : current[0].monto_pagado},
        saldo_pendiente = ${updateData.saldo_pendiente !== undefined ? updateData.saldo_pendiente : current[0].saldo_pendiente},
        fecha_liquidacion = ${updateData.fecha_liquidacion !== undefined ? updateData.fecha_liquidacion : current[0].fecha_liquidacion},
        autorizado_por = ${updateData.autorizado_por !== undefined ? updateData.autorizado_por : current[0].autorizado_por},
        contractual_due_date = ${updateData.contractual_due_date !== undefined ? updateData.contractual_due_date : current[0].contractual_due_date},
        original_friday = ${updateData.original_friday !== undefined ? updateData.original_friday : current[0].original_friday},
        adjustment_reason = ${updateData.adjustment_reason !== undefined ? updateData.adjustment_reason : current[0].adjustment_reason},
        calendar_version = ${updateData.calendar_version !== undefined ? updateData.calendar_version : current[0].calendar_version},
        bank_account_id = ${updateData.bank_account_id !== undefined ? updateData.bank_account_id : current[0].bank_account_id},
        owner_type = ${updateData.owner_type !== undefined ? updateData.owner_type : current[0].owner_type},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    const auditAction = (updateData.monto_pagado !== undefined || updateData.payment_proof_url) ? 'pago_aplicado' : 'updated';
    const auditReason = (updateData.monto_pagado !== undefined || updateData.payment_proof_url) 
      ? ('Aplicación de pago' + (ref ? ' ref:' + ref.slice(0,30) : '')) 
      : (updateData.audit_reason || 'Actualización de pago programado');

    await sql`
      INSERT INTO payment_schedule_audit (
        payment_id,
        action,
        user_name,
        old_data,
        new_data,
        reason,
        timestamp
      ) VALUES (
        ${id},
        ${auditAction},
        ${updateData.updated_by || 'system'},
        ${JSON.stringify(current[0])},
        ${JSON.stringify(result[0])},
        ${auditReason},
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating payment schedule:", error);
    return NextResponse.json(
      { error: "Error al actualizar programación de pago" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID es requerido" },
        { status: 400 }
      );
    }

    // Get current data for audit
    const current = await sql`
      SELECT * FROM payment_schedule
      WHERE id = ${parseInt(id)}
    `;

    if (current.length === 0) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 }
      );
    }

    // Create audit log before deletion
    await sql`
      INSERT INTO payment_schedule_audit (
        payment_id,
        action,
        user_name,
        old_data,
        reason,
        timestamp
      ) VALUES (
        ${parseInt(id)},
        'deleted',
        'system',
        ${JSON.stringify(current[0])},
        'Pago programado eliminado',
        CURRENT_TIMESTAMP
      )
    `;

    await sql`DELETE FROM payment_schedule WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment schedule:", error);
    return NextResponse.json(
      { error: "Error al eliminar programación de pago" },
      { status: 500 }
    );
  }
}
