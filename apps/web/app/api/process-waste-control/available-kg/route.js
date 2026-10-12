import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * GET: Get available kg of process and waste for a given week
 * This pulls from lotification data
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

    // Get total kg proceso and desecho from lotification_calibers for the week
    // Join with lotification_registry to get the date range
    const procesoKg = await sql`
      SELECT COALESCE(SUM(lc.process_kg), 0) as total_proceso_kg
      FROM lotification_calibers lc
      JOIN lotification_registry lr ON lc.registry_id = lr.id
      WHERE lr.selection_date BETWEEN ${weekStartDate} AND ${weekEndDate}
    `;

    const desechoKg = await sql`
      SELECT COALESCE(SUM(lc.waste_kg), 0) as total_desecho_kg
      FROM lotification_calibers lc
      JOIN lotification_registry lr ON lc.registry_id = lr.id
      WHERE lr.selection_date BETWEEN ${weekStartDate} AND ${weekEndDate}
    `;

    // Get already sold kg for this week from process_waste_sales
    const soldProcesoKg = await sql`
      SELECT COALESCE(SUM(kg_sold), 0) as sold_kg
      FROM process_waste_sales
      WHERE sale_type = 'proceso'
        AND week_start_date = ${weekStartDate}
        AND status = 'aprobado'
    `;

    const soldDesechoKg = await sql`
      SELECT COALESCE(SUM(kg_sold), 0) as sold_kg
      FROM process_waste_sales
      WHERE sale_type = 'desecho'
        AND week_start_date = ${weekStartDate}
        AND status = 'aprobado'
    `;

    const totalProcesoKg = parseFloat(procesoKg[0].total_proceso_kg);
    const totalDesechoKg = parseFloat(desechoKg[0].total_desecho_kg);
    const procesoKgSold = parseFloat(soldProcesoKg[0].sold_kg);
    const desechoKgSold = parseFloat(soldDesechoKg[0].sold_kg);

    return NextResponse.json({
      proceso: {
        total_kg: totalProcesoKg,
        sold_kg: procesoKgSold,
        available_kg: totalProcesoKg - procesoKgSold
      },
      desecho: {
        total_kg: totalDesechoKg,
        sold_kg: desechoKgSold,
        available_kg: totalDesechoKg - desechoKgSold
      },
      week_start_date: weekStartDate,
      week_end_date: weekEndDate
    });
  } catch (error) {
    console.error("Error fetching available kg:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
