import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener configuración del mapa de tráiler para una carga
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loadId = searchParams.get("loadId");

    if (!loadId) {
      return NextResponse.json({ error: "loadId requerido" }, { status: 400 });
    }

    const slots = await sql`
      SELECT * FROM trailer_load_map 
      WHERE load_id = ${parseInt(loadId)} 
      ORDER BY unload_order ASC
    `;

    return NextResponse.json(slots);
  } catch (error) {
    console.error("Error fetching trailer map:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: asignar producto a una posición del tráiler
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      loadId, slotPosition, lotId, caliber, className, 
      boxes, kilos, unloadOrder, destination, userResponsible, notes 
    } = body;

    // Validar inventario disponible
    const [inventory] = await sql`
      SELECT total_kg FROM lot_inventory 
      WHERE lot_id = ${lotId} 
      AND caliber = ${caliber} 
      AND class_name = ${className}
    `;

    if (!inventory || parseFloat(inventory.total_kg) < parseFloat(kilos)) {
      return NextResponse.json({ 
        error: "Inventario insuficiente" 
      }, { status: 400 });
    }

    // Reservar inventario (marcar como "asignado a carga")
    await sql`
      UPDATE lot_inventory 
      SET total_kg = total_kg - ${parseFloat(kilos)}
      WHERE lot_id = ${lotId} 
      AND caliber = ${caliber} 
      AND class_name = ${className}
    `;

    // Registrar posición en el mapa del tráiler
    const [slot] = await sql`
      INSERT INTO trailer_load_map (
        load_id, slot_position, lot_id, caliber, class_name,
        boxes, kilos, unload_order, destination, user_responsible, notes
      ) VALUES (
        ${loadId}, ${slotPosition}, ${lotId}, ${caliber}, ${className},
        ${boxes}, ${parseFloat(kilos)}, ${unloadOrder || null}, ${destination || null},
        ${userResponsible || null}, ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    console.error("Error assigning trailer slot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: confirmar carga (finalizar y descontar inventario definitivamente)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { loadId, userId, userName } = body;

    // Obtener todas las posiciones de la carga
    const slots = await sql`
      SELECT * FROM trailer_load_map WHERE load_id = ${loadId}
    `;

    if (slots.length === 0) {
      return NextResponse.json({ error: "No hay producto asignado a esta carga" }, { status: 400 });
    }

    // Descontar inventario definitivamente y actualizar lote
    for (const slot of slots) {
      // Actualizar totales del lote
      await sql`
        UPDATE lots 
        SET 
          total_kg_sold = COALESCE(total_kg_sold, 0) + ${slot.kilos},
          total_kg_inventory = COALESCE(total_kg_inventory, 0) - ${slot.kilos}
        WHERE id = ${slot.lot_id}
      `;

      // Registrar en trazabilidad
      await sql`
        INSERT INTO traceability_log (
          lot_id, event_type, event_category, event_description,
          related_entity_type, related_entity_id, user_name, metadata
        ) VALUES (
          ${slot.lot_id}, 'sale', 'load_confirmed', 
          'Producto cargado y confirmado en tráiler',
          'load_history', ${loadId}, ${userName || 'Sistema'},
          ${JSON.stringify({ slot_position: slot.slot_position, kilos: slot.kilos, caliber: slot.caliber })}
        )
      `;
    }

    // Actualizar estado de la carga
    await sql`
      UPDATE load_history 
      SET payment_status = 'confirmed'
      WHERE id = ${loadId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Carga confirmada y inventario descontado", 
      slotsProcessed: slots.length 
    });
  } catch (error) {
    console.error("Error confirming load:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: cancelar asignación de una posición
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "slotId requerido" }, { status: 400 });
    }

    // Obtener datos de la posición
    const [slot] = await sql`
      SELECT * FROM trailer_load_map WHERE id = ${parseInt(slotId)}
    `;

    if (!slot) {
      return NextResponse.json({ error: "Posición no encontrada" }, { status: 404 });
    }

    // Devolver inventario
    await sql`
      UPDATE lot_inventory 
      SET total_kg = total_kg + ${slot.kilos}
      WHERE lot_id = ${slot.lot_id} 
      AND caliber = ${slot.caliber} 
      AND class_name = ${slot.class_name}
    `;

    // Eliminar posición
    await sql`DELETE FROM trailer_load_map WHERE id = ${parseInt(slotId)}`;

    return NextResponse.json({ success: true, message: "Posición liberada e inventario restaurado" });
  } catch (error) {
    console.error("Error deleting trailer slot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
