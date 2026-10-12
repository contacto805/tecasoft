import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get all triggered alerts (where current quantity is below or equal to threshold)
    const triggeredAlerts = await sql`
      SELECT 
        ma.id, 
        ma.material_id, 
        mi.material_name,
        mi.category,
        mi.quantity_available,
        mi.minimum_stock,
        ma.alert_type, 
        ma.alert_threshold, 
        ma.alert_message,
        ROUND(((mi.quantity_available::NUMERIC / NULLIF(ma.alert_threshold, 0)) * 100)::NUMERIC, 2) as percentage_of_threshold,
        ROUND(((mi.quantity_available::NUMERIC / NULLIF(mi.minimum_stock, 1)) * 100)::NUMERIC, 2) as percentage_of_minimum
      FROM material_alerts ma
      JOIN materials_inventory mi ON ma.material_id = mi.id
      WHERE ma.is_active = true 
        AND mi.quantity_available <= ma.alert_threshold
      ORDER BY mi.quantity_available ASC
    `.catch(() => []);

    return NextResponse.json(triggeredAlerts);
  } catch (error) {
    return NextResponse.json([]);
  }
}
