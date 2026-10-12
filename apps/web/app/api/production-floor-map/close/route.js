import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { lotId, userId, userName } = body;

    if (!lotId) {
      return NextResponse.json({ error: "lotId requerido" }, { status: 400 });
    }

    // Obtener estado actual del piso
    const floorState = await sql`
      SELECT * FROM production_floor_map 
      WHERE lot_id = ${lotId} 
      AND status = 'in_progress'
    `;

    if (floorState.length === 0) {
      return NextResponse.json({ error: "No hay estado de producción activo para este lote" }, { status: 404 });
    }

    // Validaciones de cierre
    const finishedProduct = floorState.find(area => area.area_name === 'finished');
    const unassignedProduct = floorState.filter(area => 
      !['finished', 'process', 'waste', 'shrinkage', 'to_warehouse', 'to_load'].includes(area.area_name) &&
      parseFloat(area.kilos_current || 0) > 0
    );

    if (unassignedProduct.length > 0) {
      const pendingAreas = unassignedProduct.map(a => `${a.area_name} (${a.kilos_current} kg)`).join(', ');
      return NextResponse.json({ 
        error: `No se puede cerrar: Hay producto sin destino en: ${pendingAreas}` 
      }, { status: 400 });
    }

    // Validar cuadre de kilos
    const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    const totalProcessed = floorState.reduce((sum, area) => {
      if (['finished', 'process', 'waste', 'shrinkage'].includes(area.area_name)) {
        return sum + parseFloat(area.kilos_current || 0);
      }
      return sum;
    }, 0);

    const totalReceived = parseFloat(lot.total_kg_received || 0);
    const difference = Math.abs(totalReceived - totalProcessed);

    if (difference > 5) { // Tolerancia de 5kg
      return NextResponse.json({ 
        error: `Diferencia de ${difference.toFixed(2)} kg entre kilos recibidos (${totalReceived}) y procesados (${totalProcessed}). Justifica la diferencia.` 
      }, { status: 400 });
    }

    // Enviar producto terminado a inventario
    if (finishedProduct && parseFloat(finishedProduct.kilos_current || 0) > 0) {
      // Crear registro en lot_inventory
      const caliber = finishedProduct.caliber || 'Sin calibre';
      const className = finishedProduct.quality || 'Calidad A';

      const [existingInventory] = await sql`
        SELECT * FROM lot_inventory 
        WHERE lot_id = ${lotId} 
        AND caliber = ${caliber} 
        AND class_name = ${className}
      `;

      if (existingInventory) {
        await sql`
          UPDATE lot_inventory 
          SET total_kg = total_kg + ${finishedProduct.kilos_current}
          WHERE lot_id = ${lotId} 
          AND caliber = ${caliber} 
          AND class_name = ${className}
        `;
      } else {
        await sql`
          INSERT INTO lot_inventory (lot_id, caliber, class_name, total_kg, creation_date)
          VALUES (${lotId}, ${caliber}, ${className}, ${finishedProduct.kilos_current}, CURRENT_DATE)
        `;
      }

      // Actualizar total_kg_inventory del lote
      await sql`
        UPDATE lots 
        SET total_kg_inventory = COALESCE(total_kg_inventory, 0) + ${finishedProduct.kilos_current}
        WHERE id = ${lotId}
      `;
    }

    // Marcar todas las áreas como cerradas
    await sql`
      UPDATE production_floor_map 
      SET status = 'closed'
      WHERE lot_id = ${lotId} 
      AND status = 'in_progress'
    `;

    // Actualizar estado del lote
    await sql`
      UPDATE lots 
      SET status = 'production_completed',
          lot_traceability_status = 'production_completed'
      WHERE id = ${lotId}
    `;

    // Registrar en trazabilidad
    await sql`
      INSERT INTO traceability_log (
        lot_id, event_type, event_category, event_description,
        user_name, metadata
      ) VALUES (
        ${lotId}, 'production', 'production_closed',
        'Producción cerrada y producto enviado al inventario',
        ${userName || 'Sistema'},
        ${JSON.stringify({ total_processed: totalProcessed, total_received: totalReceived, difference })}
      )
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Producción cerrada exitosamente", 
      totalProcessed, 
      totalReceived, 
      difference 
    });
  } catch (error) {
    console.error("Error closing production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
