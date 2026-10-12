import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { lotId, fromArea, toArea, kilos, boxes, caliber, quality, personnelAssigned, userId, userName, observations } = body;

    if (!lotId || !fromArea || !toArea || !kilos) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    // Validar que hay suficiente producto en el área origen
    const [sourceArea] = await sql`
      SELECT * FROM production_floor_map 
      WHERE lot_id = ${lotId} 
      AND area_name = ${fromArea}
      AND status = 'in_progress'
      ORDER BY timestamp DESC 
      LIMIT 1
    `;

    if (!sourceArea || parseFloat(sourceArea.kilos_current || 0) < parseFloat(kilos)) {
      return NextResponse.json({ 
        error: `No hay suficientes kilos en ${fromArea}. Disponible: ${sourceArea?.kilos_current || 0} kg` 
      }, { status: 400 });
    }

    // Restar del área origen
    await sql`
      UPDATE production_floor_map 
      SET 
        kilos_current = kilos_current - ${parseFloat(kilos)},
        timestamp = CURRENT_TIMESTAMP
      WHERE lot_id = ${lotId} 
      AND area_name = ${fromArea}
      AND status = 'in_progress'
    `;

    // Sumar al área destino (crear o actualizar)
    const [existingTarget] = await sql`
      SELECT * FROM production_floor_map 
      WHERE lot_id = ${lotId} 
      AND area_name = ${toArea}
      AND status = 'in_progress'
      LIMIT 1
    `;

    if (existingTarget) {
      await sql`
        UPDATE production_floor_map 
        SET 
          kilos_current = kilos_current + ${parseFloat(kilos)},
          boxes_current = COALESCE(boxes_current, 0) + ${boxes || 0},
          caliber = COALESCE(${caliber || null}, caliber),
          quality = COALESCE(${quality || null}, quality),
          personnel_assigned = COALESCE(${personnelAssigned || null}, personnel_assigned),
          user_responsible = ${userName || null},
          timestamp = CURRENT_TIMESTAMP
        WHERE lot_id = ${lotId} 
        AND area_name = ${toArea}
        AND status = 'in_progress'
      `;
    } else {
      const areaOrder = {
        'reception': 1, 'weighing': 2, 'waiting': 3, 'selection': 4,
        'classification': 5, 'packing': 6, 'finished': 7, 'process': 8,
        'waste': 9, 'shrinkage': 10, 'temp_storage': 11, 'to_warehouse': 12, 'to_load': 13
      };

      await sql`
        INSERT INTO production_floor_map (
          lot_id, area_name, area_order, kilos_current, boxes_current,
          caliber, quality, personnel_assigned, user_responsible, status
        ) VALUES (
          ${lotId}, ${toArea}, ${areaOrder[toArea] || 99}, ${parseFloat(kilos)}, ${boxes || 0},
          ${caliber || null}, ${quality || null}, ${personnelAssigned || null},
          ${userName || null}, 'in_progress'
        )
      `;
    }

    // Registrar en log de movimientos
    await sql`
      INSERT INTO production_floor_movements_log (
        lot_id, area_from, area_to, kilos_moved, boxes_generated,
        caliber, quality, personnel_assigned, user_responsible, observations
      ) VALUES (
        ${lotId}, ${fromArea}, ${toArea}, ${parseFloat(kilos)}, ${boxes || 0},
        ${caliber || null}, ${quality || null}, ${personnelAssigned || null},
        ${userName || null}, ${observations || null}
      )
    `;

    // Actualizar totales del lote según el área destino
    if (toArea === 'finished') {
      await sql`
        UPDATE lots 
        SET total_kg_packed = COALESCE(total_kg_packed, 0) + ${parseFloat(kilos)}
        WHERE id = ${lotId}
      `;
    } else if (toArea === 'process') {
      await sql`
        UPDATE lots 
        SET total_kg_process = COALESCE(total_kg_process, 0) + ${parseFloat(kilos)}
        WHERE id = ${lotId}
      `;
    } else if (toArea === 'waste') {
      await sql`
        UPDATE lots 
        SET total_kg_waste = COALESCE(total_kg_waste, 0) + ${parseFloat(kilos)}
        WHERE id = ${lotId}
      `;
    } else if (toArea === 'shrinkage') {
      await sql`
        UPDATE lots 
        SET total_kg_inventory = COALESCE(total_kg_inventory, 0) - ${parseFloat(kilos)}
        WHERE id = ${lotId}
      `;
    }

    return NextResponse.json({ 
      success: true, 
      message: `${kilos} kg movidos de ${fromArea} a ${toArea}` 
    });
  } catch (error) {
    console.error("Error moving product on production floor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
