import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * GET: Dashboard Financiero de Producción
 * Shows weekly production and waste performance with financial metrics
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStartDate = searchParams.get("weekStartDate");
    const weekEndDate = searchParams.get("weekEndDate");

    if (!weekStartDate || !weekEndDate) {
      return NextResponse.json(
        { error: "weekStartDate y weekEndDate son requeridos" },
        { status: 400 }
      );
    }

    // 1. Fruta Ingresada Semana - from Recepción
    const frutaIngresada = await sql`
      SELECT COALESCE(SUM(total_kg_weighed), 0) as total_kg
      FROM fruit_input_weighings
      WHERE public_scale_date BETWEEN ${weekStartDate} AND ${weekEndDate}
    `;

    // 2. Fruta Proceso - kg and $ from sales_of_process_and_waste
    const frutaProceso = await sql`
      SELECT 
        COALESCE(SUM(process_kg), 0) as total_kg,
        COALESCE(SUM(total_price), 0) as total_monto
      FROM sales_of_process_and_waste
      WHERE process_kg > 0 AND date BETWEEN ${weekStartDate} AND ${weekEndDate}
    `;

    // 3. Fruta Desecho - kg and $ from sales_of_process_and_waste
    const frutaDesecho = await sql`
      SELECT 
        COALESCE(SUM(waste_kg), 0) as total_kg,
        COALESCE(SUM(total_price), 0) as total_monto
      FROM sales_of_process_and_waste
      WHERE waste_kg > 0 AND date BETWEEN ${weekStartDate} AND ${weekEndDate}
    `;

    // 4 & 5. Calculate percentages
    const kgIngresados = parseFloat(frutaIngresada[0].total_kg);
    const kgProceso = parseFloat(frutaProceso[0].total_kg);
    const kgDesecho = parseFloat(frutaDesecho[0].total_kg);

    const rendimientoProceso = kgIngresados > 0 ? (kgProceso / kgIngresados) * 100 : 0;
    const rendimientoDesecho = kgIngresados > 0 ? (kgDesecho / kgIngresados) * 100 : 0;

    return NextResponse.json({
      fruta_ingresada_kg: kgIngresados,
      fruta_proceso_kg: kgProceso,
      fruta_proceso_monto: parseFloat(frutaProceso[0].total_monto),
      fruta_desecho_kg: kgDesecho,
      fruta_desecho_monto: parseFloat(frutaDesecho[0].total_monto),
      rendimiento_proceso: rendimientoProceso,
      rendimiento_desecho: rendimientoDesecho,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate
    });
  } catch (error) {
    console.error("Error fetching dashboard financiero producción:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
