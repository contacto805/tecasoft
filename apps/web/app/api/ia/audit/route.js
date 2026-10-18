import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const issues = [];

    // Duplicados en producción
    const [dups] = await sql`SELECT COUNT(*) as c FROM (SELECT lot_id FROM production_batches GROUP BY lot_id HAVING COUNT(*)>1) x`;
    if (dups?.c > 0) issues.push({ tipo: "Lotes con batches duplicados", cantidad: Number(dups.c) });

    // Kg sin pesaje
    const [kg] = await sql`SELECT COUNT(*) as c FROM lots l LEFT JOIN fruit_input_weighings w ON w.lot_id = l.id WHERE COALESCE(l.total_kg_received,0) > 0 AND w.id IS NULL`;
    if (kg?.c > 0) issues.push({ tipo: "Kg recibidos sin pesaje público", cantidad: Number(kg.c) });

    // Bancos sin conciliar
    const [bank] = await sql`SELECT COUNT(*) as c FROM bank_movements WHERE COALESCE(status,'') NOT IN ('reconciled','matched')`;
    if (bank?.c > 4) issues.push({ tipo: "Movimientos bancarios pendientes de conciliación", cantidad: Number(bank.c) });

    // Pagos vencidos sin autorizar
    const [pay] = await sql`SELECT COUNT(*) as c FROM payment_schedule WHERE saldo_pendiente > 0 AND scheduled_payment_date < CURRENT_DATE`;
    if (pay?.c > 0) issues.push({ tipo: "Pagos vencidos sin liquidar", cantidad: Number(pay.c) });

    // Lotes sin rendimiento
    const [perf] = await sql`SELECT COUNT(*) as c FROM lots WHERE id NOT IN (SELECT lot_id FROM lot_performance)`;
    if (perf?.c > 0) issues.push({ tipo: "Lotes sin registro de rendimiento", cantidad: Number(perf.c) });

    return NextResponse.json({
      source: "lots, production_batches, bank_movements, payment_schedule, lot_performance",
      estado: "detectado",
      updated: new Date().toISOString(),
      calculo: "Consultas cruzadas para inconsistencias operativas y financieras",
      issues
    });
  } catch (e) {
    return NextResponse.json({ issues: [{ tipo: "Error temporal de auditoría", cantidad: 0 }] });
  }
}
