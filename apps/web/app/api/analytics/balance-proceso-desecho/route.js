import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * GET: Balance de Proceso y Desecho - Analytics
 * Analytical module showing production yields and waste conversion
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate y endDate son requeridos" },
        { status: 400 }
      );
    }

    // 1. Fruta recibida del período
    const frutaRecibida = await sql`
      SELECT COALESCE(SUM(total_kg_weighed), 0) as total_kg
      FROM fruit_input_weighings
      WHERE public_scale_date BETWEEN ${startDate} AND ${endDate}
    `;

    // 2. Kg proceso y desecho from lotification_calibers
    const procesoDesecho = await sql`
      SELECT 
        COALESCE(SUM(lc.process_kg), 0) as proceso_kg,
        COALESCE(SUM(lc.waste_kg), 0) as desecho_kg
      FROM lotification_calibers lc
      JOIN lotification_registry lr ON lc.registry_id = lr.id
      WHERE lr.selection_date BETWEEN ${startDate} AND ${endDate}
    `;

    const frutaRecibidaKg = parseFloat(frutaRecibida[0].total_kg);
    const procesoKg = parseFloat(procesoDesecho[0].proceso_kg);
    const desechoKg = parseFloat(procesoDesecho[0].desecho_kg);

    const conversionProceso = frutaRecibidaKg > 0 ? (procesoKg / frutaRecibidaKg) * 100 : 0;
    const conversionDesecho = frutaRecibidaKg > 0 ? (desechoKg / frutaRecibidaKg) * 100 : 0;
    const aprovechamientoTotal = conversionProceso + conversionDesecho;

    // 3. Lotificaciones detail
    const lotificaciones = await sql`
      SELECT 
        l.lot_number,
        l.producer,
        lr.selection_date as date,
        lr.total_kilos_received as kg_received,
        COALESCE(SUM(lc.process_kg), 0) as kg_process,
        COALESCE(SUM(lc.waste_kg), 0) as kg_waste
      FROM lotification_registry lr
      JOIN lots l ON lr.lot_id = l.id
      LEFT JOIN lotification_calibers lc ON lc.registry_id = lr.id
      WHERE lr.selection_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY l.id, l.lot_number, l.producer, lr.selection_date, lr.total_kilos_received
      ORDER BY lr.selection_date DESC
    `;

    const lotificacionesFormatted = lotificaciones.map(lot => ({
      lot_number: lot.lot_number,
      producer: lot.producer,
      date: lot.date,
      kg_received: parseFloat(lot.kg_received),
      kg_process: parseFloat(lot.kg_process),
      kg_waste: parseFloat(lot.kg_waste),
      percent_process: parseFloat(lot.kg_received) > 0 ? (parseFloat(lot.kg_process) / parseFloat(lot.kg_received)) * 100 : 0,
      percent_waste: parseFloat(lot.kg_received) > 0 ? (parseFloat(lot.kg_waste) / parseFloat(lot.kg_received)) * 100 : 0
    }));

    // TODO: Add historical comparison data (previous week, month, year)

    return NextResponse.json({
      fruta_recibida_kg: frutaRecibidaKg,
      proceso_kg: procesoKg,
      desecho_kg: desechoKg,
      conversion_proceso: conversionProceso,
      conversion_desecho: conversionDesecho,
      aprovechamiento_total: aprovechamientoTotal,
      lotificaciones: lotificacionesFormatted,
      // Placeholder data for comparisons - these should be calculated from actual historical data
      semana_actual_kg: frutaRecibidaKg,
      semana_anterior_kg: 0,
      variacion_semanal: 0,
      mes_actual_kg: frutaRecibidaKg,
      mes_anterior_kg: 0,
      variacion_mensual: 0,
      anio_actual_kg: frutaRecibidaKg,
      promedio_anual_kg: 0,
      vs_promedio: 0
    });
  } catch (error) {
    console.error("Error fetching balance proceso/desecho analytics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
