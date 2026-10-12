import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const format = searchParams.get("format") || "pdf";

    if (!lotId) {
      return NextResponse.json({ error: "Lot ID required" }, { status: 400 });
    }

    // Obtener datos de rendimiento
    const [performance] = await sql`
      SELECT * FROM lot_performance WHERE lot_id = ${parseInt(lotId)}
    `;

    if (!performance) {
      return NextResponse.json({ error: "Performance not found" }, { status: 404 });
    }

    // Preparar datos para descarga
    const data = {
      lotNumber: performance.lot_number,
      producer: performance.producer,
      brokerName: performance.broker_name,
      fruitType: performance.fruit_type,
      entryDate: performance.entry_date,
      publicScaleKg: performance.public_scale_weight_kg,
      totalBoxes: performance.total_boxes_produced,
      totalKgProduced: performance.total_kg_produced,
      percentageByCaliber: performance.percentage_by_caliber,
      kgByCaliber: performance.kg_by_caliber,
      percentageByQuality: performance.percentage_by_quality,
      kgByQuality: performance.kg_by_quality,
      totalKgProcess: performance.total_kg_process,
      totalKgWaste: performance.total_kg_waste,
      totalKgShrinkage: performance.total_kg_shrinkage,
      performancePercentage: performance.performance_percentage,
      processPercentage: performance.process_percentage,
      wastePercentage: performance.waste_percentage,
      shrinkagePercentage: performance.shrinkage_percentage,
      generatedAt: performance.generated_at
    };

    return NextResponse.json({ 
      success: true, 
      data,
      message: `Datos preparados para descarga en ${format.toUpperCase()}`
    });
  } catch (error) {
    console.error("Error downloading lot performance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
