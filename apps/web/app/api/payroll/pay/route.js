import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST - Pagar nómina (devengado ya existe). Registra salida bancaria, reduce pasivo.
// NO crea gasto/costo nuevo. Una sola vez por período (idempotente por ref).
export async function POST(request) {
  try {
    const { periodId, paidBy = "Administración", amount, paymentDate, reference = "" } = await request.json();

    if (!periodId) {
      return NextResponse.json({ error: "periodId requerido" }, { status: 400 });
    }

    const pid = parseInt(periodId);
    const [period] = await sql`
      SELECT * FROM payroll_periods WHERE id = ${pid}
    `;
    if (!period) return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });

    const alreadyPaid = parseFloat(period.paid_amount || 0);
    const total = parseFloat(period.total_amount || 0);
    if (period.status === "pagado" && alreadyPaid >= total) {
      return NextResponse.json({ error: "Esta nómina ya está pagada en su totalidad" }, { status: 400 });
    }

    const toPay = amount ? parseFloat(amount) : Math.max(0, total - alreadyPaid);
    if (toPay <= 0) {
      return NextResponse.json({ error: "Monto a pagar inválido" }, { status: 400 });
    }

    const payDate = paymentDate || new Date().toISOString().split("T")[0];
    const folioRef = reference || `NOM-${period.folio || pid}`;

    // Idempotency: do not create duplicate bank movement for same ref + payroll
    const existingBank = await sql`
      SELECT id FROM bank_movements 
      WHERE suggested_entity_type = 'payroll_period' 
        AND suggested_entity_id = ${pid}
        AND reference = ${folioRef}
        AND amount = ${toPay}
      LIMIT 1
    `;
    if (existingBank.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: "Pago ya registrado (idempotente por referencia)", 
        paid: toPay, 
        duplicate: true 
      });
    }

    // 1. Registrar como movimiento bancario (egreso) - NO genera costo nuevo
    await sql`
      INSERT INTO bank_movements (
        movement_date, description, reference, beneficiary,
        charge, credit, amount, currency, concept, status,
        suggested_entity_type, suggested_entity_id, category
      ) VALUES (
        ${payDate}, ${`Pago nómina ${period.folio || ''}`}, ${folioRef}, 'Nómina',
        ${toPay}, 0, ${toPay}, 'MXN', 'Nómina', 'pendiente',
        'payroll_period', ${pid}, 'Nómina'
      )
    `;

    // 2. Actualizar período: reducir pasivo (paid_amount), marcar pagado/parcial
    const newPaid = Math.min(total, alreadyPaid + toPay);
    const newStatus = newPaid >= total ? "pagado" : "parcial";

    await sql`
      UPDATE payroll_periods
      SET paid_amount = ${newPaid},
          paid_at = ${payDate},
          paid_by = ${paidBy},
          status = ${newStatus},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${pid}
    `;

    // 3. Actualizar cierre semanal de la fecha de PAGO (banco sale en semana de pago, nómina devengada en semana de aprobación)
    const closings = await sql`
      SELECT id FROM weekly_closings 
      WHERE week_start_date <= ${payDate} AND week_end_date >= ${payDate}
      LIMIT 1
    `;
    if (closings.length > 0) {
      await sql`
        UPDATE weekly_closings
        SET bancos = COALESCE(bancos, 0) - ${toPay},
            total_egresos_dinero = COALESCE(total_egresos_dinero, 0) + ${toPay},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${closings[0].id}
      `;
    } else {
      // Crear cierre de pago si no existe (solo el banco, sin tocar nomina_semanal)
      await sql`
        INSERT INTO weekly_closings (week_start_date, week_end_date, week_label, bancos, total_egresos_dinero, status)
        VALUES (${payDate}, ${payDate}, ${'Semana pago nómina'}, ${-toPay}, ${toPay}, 'abierto')
      `;
    }

    // 4. Idempotencia: si ya había link de pago, no duplicar
    // (el insert bank + update paid_amount es suficiente; reintentos suman solo si nuevo)

    return NextResponse.json({
      success: true,
      message: "Nómina pagada. Costo devengado en semana de aprobación; egreso bancario en semana de pago.",
      paid: toPay,
      newPaidTotal: newPaid,
      status: newStatus
    });
  } catch (error) {
    console.error("Error paying payroll:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
