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

// POST: asignar producto a una posición del tráiler (BORRADOR - solo registra posición, sin descuento de inventario)
// El descuento único y la creación de venta/CxC ocurre SOLO en loads/complete (único comando transaccional)
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      loadId, slotPosition, lotId, caliber, className, 
      boxes, kilos, unloadOrder, destination, userResponsible, notes 
    } = body;

    // Solo registra la posición en el mapa del tráiler (draft/reserva visual).
    // NO se descuenta stock aquí. Fuente canónica: pallet_output_summary.
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

// PUT: confirmar mapa de tráiler (solo marca estado operativo del mapa)
// El descuento físico único, la venta y la CxC se hacen en UN SOLO comando: loads/complete
// (evita duplicación de descuentos y ventas al confirmar salida)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { loadId } = body;

    const slots = await sql`
      SELECT * FROM trailer_load_map WHERE load_id = ${loadId}
    `;

    if (slots.length === 0) {
      return NextResponse.json({ error: "No hay posiciones asignadas" }, { status: 400 });
    }

    // Solo actualiza estado del mapa / carga (sin tocar inventario ni crear ventas)
    await sql`
      UPDATE load_history 
      SET payment_status = 'confirmed', updated_at = NOW()
      WHERE id = ${loadId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Mapa de tráiler confirmado (descuento y venta en loads/complete)", 
      slotsProcessed: slots.length 
    });
  } catch (error) {
    console.error("Error confirming trailer map:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: cancelar asignación de una posición del mapa (borrador)
// Como el assign ya no descuenta, solo elimina la posición del mapa
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "slotId requerido" }, { status: 400 });
    }

    await sql`DELETE FROM trailer_load_map WHERE id = ${parseInt(slotId)}`;

    return NextResponse.json({ success: true, message: "Posición liberada (sin movimiento de stock en borrador)" });
  } catch (error) {
    console.error("Error deleting trailer slot:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
