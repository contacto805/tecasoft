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

async function computePaymentSchedule(fruitReceptionDateStr, paymentDays, cuttingOrderId = null) {
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

    if (conditions.length > 0) {
      where = sql`WHERE ${conditions[0]}`;
      for (let i = 1; i < conditions.length; i++) {
        where = sql`${where} AND ${conditions[i]}`;
      }
    }

    const payments = await sql`
      SELECT * FROM payment_schedule
      ${where}
      ORDER BY scheduled_payment_date ASC, priority DESC
    `;

    return NextResponse.json(payments);
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
        calendar_version
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
        ${schedule.calendar_version}
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
        contractual_due_date = ${updateData.contractual_due_date !== undefined ? updateData.contractual_due_date : current[0].contractual_due_date},
        original_friday = ${updateData.original_friday !== undefined ? updateData.original_friday : current[0].original_friday},
        adjustment_reason = ${updateData.adjustment_reason !== undefined ? updateData.adjustment_reason : current[0].adjustment_reason},
        calendar_version = ${updateData.calendar_version !== undefined ? updateData.calendar_version : current[0].calendar_version},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    // Create audit log
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
        'updated',
        ${updateData.updated_by || 'system'},
        ${JSON.stringify(current[0])},
        ${JSON.stringify(result[0])},
        ${updateData.audit_reason || 'Actualización de pago programado'},
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
