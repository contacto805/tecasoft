import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: Obtener rendimientos de lotes o calcular en automático
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const autoCalculate = searchParams.get("autoCalculate");

    // Calcular rendimientos automáticamente desde producción y entrada de fruta
    if (autoCalculate === "true" && lotId) {
      const lotIdNum = parseInt(lotId);

      // Obtener datos generales del lote
      const [lot] = await sql`
        SELECT 
          l.*,
          COALESCE(f.total_kg_weighed, 0) as public_scale_kg
        FROM lots l
        LEFT JOIN fruit_input_weighings f ON f.lot_id = l.id
        WHERE l.id = ${lotIdNum}
      `;

      if (!lot) {
        return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
      }

      // Obtener producción por calibre y calidad
      const production = await sql`
        SELECT 
          psd.caliber,
          psd.class_name,
          COALESCE(SUM(psd.total_kg), 0) as total_kg,
          COALESCE(SUM(psd.boxes_10kg), 0) as boxes_10kg,
          COALESCE(SUM(psd.boxes_6kg), 0) as boxes_6kg,
          COALESCE(SUM(psd.boxes_96), 0) as boxes_96,
          COALESCE(SUM(psd.boxes_156), 0) as boxes_156,
          COALESCE(SUM(psd.pallets_complete), 0) as pallets
        FROM production_selection_details psd
        WHERE psd.lot_id = ${lotIdNum}
        GROUP BY psd.caliber, psd.class_name
      `;

      // Calcular totales
      const totalKgProduced = production.reduce((sum, p) => sum + parseFloat(p.total_kg || 0), 0);
      const totalBoxes = production.reduce((sum, p) => 
        sum + parseFloat(p.boxes_10kg || 0) + parseFloat(p.boxes_6kg || 0) + 
        parseFloat(p.boxes_96 || 0) + parseFloat(p.boxes_156 || 0), 0);

      const publicScaleKg = parseFloat(lot.public_scale_kg || 0);
      const processKg = parseFloat(lot.total_kg_process || 0);
      const wasteKg = parseFloat(lot.total_kg_waste || 0);

      // Calcular porcentajes por calibre
      const calibers = {};
      const calibersKg = {};
      production.forEach(p => {
        const caliber = p.caliber || "Sin calibre";
        const kg = parseFloat(p.total_kg || 0);
        
        if (!calibersKg[caliber]) {
          calibersKg[caliber] = 0;
        }
        calibersKg[caliber] += kg;
      });

      Object.keys(calibersKg).forEach(caliber => {
        calibers[caliber] = totalKgProduced > 0 
          ? parseFloat(((calibersKg[caliber] / totalKgProduced) * 100).toFixed(2))
          : 0;
      });

      // Calcular porcentajes por calidad
      const qualities = {};
      const qualitiesKg = {};
      production.forEach(p => {
        const quality = p.class_name || "Sin calidad";
        const kg = parseFloat(p.total_kg || 0);
        
        if (!qualitiesKg[quality]) {
          qualitiesKg[quality] = 0;
        }
        qualitiesKg[quality] += kg;
      });

      Object.keys(qualitiesKg).forEach(quality => {
        qualities[quality] = totalKgProduced > 0 
          ? parseFloat(((qualitiesKg[quality] / totalKgProduced) * 100).toFixed(2))
          : 0;
      });
    // Rendimiento REAL DESPUÉS DE SELECCIÓN (kg comercializables post selección)
    const kgAfterSelection = totalKgProduced;
    const performancePercentage = publicScaleKg > 0 
      ? parseFloat(((kgAfterSelection / publicScaleKg) * 100).toFixed(2))
      : 0;

      const processPercentage = publicScaleKg > 0 
        ? parseFloat(((processKg / publicScaleKg) * 100).toFixed(2))
        : 0;

      const wastePercentage = publicScaleKg > 0 
        ? parseFloat(((wasteKg / publicScaleKg) * 100).toFixed(2))
        : 0;

      const shrinkageKg = publicScaleKg - totalKgProduced - processKg - wasteKg;
      const shrinkagePercentage = publicScaleKg > 0 
        ? parseFloat(((shrinkageKg / publicScaleKg) * 100).toFixed(2))
        : 0;

      // Verificar si ya existe el rendimiento
      const [existing] = await sql`
        SELECT id FROM lot_performance WHERE lot_id = ${lotIdNum}
      `;

      let result;
      if (existing) {
        // Actualizar
        [result] = await sql`
          UPDATE lot_performance SET
            lot_number = ${lot.lot_number},
            producer = ${lot.producer},
            broker_name = ${lot.broker_name || null},
            fruit_type = ${lot.fruit_type},
            entry_date = ${lot.date},
            public_scale_weight_kg = ${publicScaleKg},
            total_boxes_produced = ${totalBoxes},
            total_kg_produced = ${totalKgProduced},
            percentage_by_caliber = ${JSON.stringify(calibers)},
            kg_by_caliber = ${JSON.stringify(calibersKg)},
            percentage_by_quality = ${JSON.stringify(qualities)},
            kg_by_quality = ${JSON.stringify(qualitiesKg)},
            total_kg_process = ${processKg},
            total_kg_waste = ${wasteKg},
            total_kg_shrinkage = ${shrinkageKg},
            performance_percentage = ${performancePercentage},
            process_percentage = ${processPercentage},
            waste_percentage = ${wastePercentage},
            shrinkage_percentage = ${shrinkagePercentage},
            last_updated = CURRENT_TIMESTAMP
          WHERE id = ${existing.id}
          RETURNING *
        `;
      } else {
        // Insertar
        [result] = await sql`
          INSERT INTO lot_performance (
            lot_id, lot_number, producer, broker_name, fruit_type, entry_date,
            public_scale_weight_kg, total_boxes_produced, total_kg_produced,
            percentage_by_caliber, kg_by_caliber, percentage_by_quality, kg_by_quality,
            total_kg_process, total_kg_waste, total_kg_shrinkage,
            performance_percentage, process_percentage, waste_percentage, shrinkage_percentage
          ) VALUES (
            ${lotIdNum}, ${lot.lot_number}, ${lot.producer}, ${lot.broker_name || null}, 
            ${lot.fruit_type}, ${lot.date},
            ${publicScaleKg}, ${totalBoxes}, ${totalKgProduced},
            ${JSON.stringify(calibers)}, ${JSON.stringify(calibersKg)},
            ${JSON.stringify(qualities)}, ${JSON.stringify(qualitiesKg)},
            ${processKg}, ${wasteKg}, ${shrinkageKg},
            ${performancePercentage}, ${processPercentage}, ${wastePercentage}, ${shrinkagePercentage}
          ) RETURNING *
        `;
      }

      // attach post-selection + real cost using central recalc
      try {
        const { recalculateLotPerformance } = await import('@/app/api/utils/recalculate');
        const extra = await recalculateLotPerformance(lotIdNum);
        if (extra) Object.assign(result, { kg_after_selection: extra.kg_after_selection, costo_real_post_seleccion: extra.costo_real_post_seleccion });
      } catch(_) {}
      return NextResponse.json(result);
    }

    // Obtener rendimiento específico
    if (lotId) {
      const [performance] = await sql`
        SELECT * FROM lot_performance WHERE lot_id = ${parseInt(lotId)}
      `;

      if (!performance) {
        return NextResponse.json({ error: "Rendimiento no encontrado" }, { status: 404 });
      }

      return NextResponse.json(performance);
    }

    // Listar todos los rendimientos
    const performances = await sql`
      SELECT * FROM lot_performance ORDER BY entry_date DESC, created_at DESC
    `;

    return NextResponse.json(performances);
  } catch (error) {
    console.error("Error fetching lot performance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Crear o actualizar rendimiento (manual override)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lotId,
      percentageByCaliber,
      kgByCaliber,
      percentageByQuality,
      kgByQuality,
      notes
    } = body;

    // Obtener datos del lote
    const [lot] = await sql`
      SELECT 
        l.*,
        COALESCE(f.total_kg_weighed, 0) as public_scale_kg
      FROM lots l
      LEFT JOIN fruit_input_weighings f ON f.lot_id = l.id
      WHERE l.id = ${parseInt(lotId)}
    `;

    if (!lot) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Calcular totales desde los datos proporcionados
    let totalKgProduced = 0;
    if (kgByCaliber) {
      Object.values(kgByCaliber).forEach(kg => {
        totalKgProduced += parseFloat(kg || 0);
      });
    }

    const publicScaleKg = parseFloat(lot.public_scale_kg || 0);
    const performancePercentage = publicScaleKg > 0 
      ? parseFloat(((totalKgProduced / publicScaleKg) * 100).toFixed(2))
      : 0;

    const [existing] = await sql`
      SELECT id FROM lot_performance WHERE lot_id = ${parseInt(lotId)}
    `;

    let result;
    if (existing) {
      [result] = await sql`
        UPDATE lot_performance SET
          percentage_by_caliber = ${JSON.stringify(percentageByCaliber || {})},
          kg_by_caliber = ${JSON.stringify(kgByCaliber || {})},
          percentage_by_quality = ${JSON.stringify(percentageByQuality || {})},
          kg_by_quality = ${JSON.stringify(kgByQuality || {})},
          total_kg_produced = ${totalKgProduced},
          performance_percentage = ${performancePercentage},
          auto_generated = false,
          last_updated = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
        RETURNING *
      `;
    } else {
      [result] = await sql`
        INSERT INTO lot_performance (
          lot_id, lot_number, producer, broker_name, fruit_type, entry_date,
          public_scale_weight_kg, total_kg_produced,
          percentage_by_caliber, kg_by_caliber, percentage_by_quality, kg_by_quality,
          performance_percentage, auto_generated
        ) VALUES (
          ${parseInt(lotId)}, ${lot.lot_number}, ${lot.producer}, ${lot.broker_name || null},
          ${lot.fruit_type}, ${lot.date},
          ${publicScaleKg}, ${totalKgProduced},
          ${JSON.stringify(percentageByCaliber || {})}, ${JSON.stringify(kgByCaliber || {})},
          ${JSON.stringify(percentageByQuality || {})}, ${JSON.stringify(kgByQuality || {})},
          ${performancePercentage}, false
        ) RETURNING *
      `;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating/updating lot performance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    await sql`DELETE FROM lot_performance WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
