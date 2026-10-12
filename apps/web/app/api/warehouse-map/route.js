import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener estado actual del mapa de almacén
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    if (lotId) {
      // Obtener movimientos específicos de un lote
      const movements = await sql`
        SELECT * FROM warehouse_map_movements 
        WHERE lot_id = ${parseInt(lotId)} 
        ORDER BY moved_at DESC
      `;
      return NextResponse.json(movements);
    }

    // Obtener estado actual de todas las posiciones ocupadas
    const currentState = await sql`
      SELECT DISTINCT ON (slot_id) 
        w.slot_id,
        w.lot_id,
        w.caliber,
        w.class_name,
        w.boxes,
        w.kilos,
        w.presentation,
        w.moved_at,
        w.notes,
        l.lot_number,
        l.producer,
        l.status
      FROM warehouse_map_movements w
      LEFT JOIN lots l ON w.lot_id = l.id
      WHERE w.movement_type = 'assign'
      ORDER BY w.slot_id, w.moved_at DESC
    `;

    return NextResponse.json(currentState);
  } catch (error) {
    console.error("Error fetching warehouse map:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: asignar producto a una posición
export async function POST(request) {
  try {
    const body = await request.json();
    const { slotId, lotId, caliber, className, boxes, kilos, presentation, userId, userName, notes } = body;

    // Validar existencia del lote
    const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Validar inventario disponible
    const [inventory] = await sql`
      SELECT total_kg FROM lot_inventory 
      WHERE lot_id = ${lotId} 
      AND caliber = ${caliber} 
      AND class_name = ${className}
    `;

    if (!inventory || parseFloat(inventory.total_kg) < parseFloat(kilos)) {
      return NextResponse.json({ 
        error: "Inventario insuficiente para este calibre y calidad" 
      }, { status: 400 });
    }

    // Validar que la posición no esté ocupada
    const [existingSlot] = await sql`
      SELECT * FROM warehouse_map_movements 
      WHERE slot_id = ${slotId} 
      AND movement_type = 'assign'
      ORDER BY moved_at DESC 
      LIMIT 1
    `;

    if (existingSlot && !body.forceOverwrite) {
      return NextResponse.json({ 
        error: "La posición ya está ocupada. Usa forceOverwrite para reemplazar." 
      }, { status: 400 });
    }

    // Registrar movimiento
    const [movement] = await sql`
      INSERT INTO warehouse_map_movements (
        slot_id, lot_id, caliber, class_name, boxes, kilos, presentation,
        movement_type, user_id, user_name, notes
      ) VALUES (
        ${slotId}, ${lotId}, ${caliber}, ${className}, ${boxes}, ${parseFloat(kilos)}, ${presentation || null},
        'assign', ${userId || null}, ${userName || null}, ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error("Error assigning to warehouse slot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: vaciar una posición
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");
    const userId = searchParams.get("userId");
    const userName = searchParams.get("userName");

    if (!slotId) {
      return NextResponse.json({ error: "slotId requerido" }, { status: 400 });
    }

    // Obtener datos de la posición actual
    const [currentSlot] = await sql`
      SELECT * FROM warehouse_map_movements 
      WHERE slot_id = ${slotId} 
      AND movement_type = 'assign'
      ORDER BY moved_at DESC 
      LIMIT 1
    `;

    if (!currentSlot) {
      return NextResponse.json({ error: "Posición ya vacía" }, { status: 404 });
    }

    // Registrar movimiento de vaciado
    const [clearMovement] = await sql`
      INSERT INTO warehouse_map_movements (
        slot_id, lot_id, caliber, class_name, boxes, kilos, presentation,
        movement_type, user_id, user_name, notes
      ) VALUES (
        ${slotId}, ${currentSlot.lot_id}, ${currentSlot.caliber}, ${currentSlot.class_name},
        ${currentSlot.boxes}, ${currentSlot.kilos}, ${currentSlot.presentation || null},
        'clear', ${userId || null}, ${userName || null}, 'Posición vaciada'
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, movement: clearMovement });
  } catch (error) {
    console.error("Error clearing warehouse slot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
