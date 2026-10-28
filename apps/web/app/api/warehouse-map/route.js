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

// POST: delega a la ruta canónica de asignación (pallet_output_summary + concurrency control)
// Mantiene compatibilidad pero no duplica lógica de inventario.
export async function POST(request) {
  try {
    const body = await request.json();
    // Forward to the single authoritative assign (handles 39 slots, one-at-a-time, pallet_output as source)
    const res = await fetch(new URL('/api/production/assign-to-slot', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pallet_output_id: body.pallet_output_id || body.palletId,
        slot_id: body.slotId || body.slot_id,
        forceOverwrite: body.forceOverwrite
      })
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error delegando asignación de almacén:", error);
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
