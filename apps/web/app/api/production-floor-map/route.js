import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener estado actual del piso de producción para un lote
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json({ error: "lotId requerido" }, { status: 400 });
    }

    const floorState = await sql`
      SELECT * FROM production_floor_map 
      WHERE lot_id = ${parseInt(lotId)} 
      AND status = 'in_progress'
      ORDER BY area_order ASC
    `;

    return NextResponse.json(floorState);
  } catch (error) {
    console.error("Error fetching production floor map:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: inicializar el mapa de piso para un lote nuevo
export async function POST(request) {
  try {
    const body = await request.json();
    const { lotId, initialKilos, userId, userName } = body;

    // Validar que el lote exista
    const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Inicializar en área de Recepción
    const [floorEntry] = await sql`
      INSERT INTO production_floor_map (
        lot_id, area_name, area_order, kilos_current, boxes_current,
        user_responsible, status
      ) VALUES (
        ${lotId}, 'reception', 1, ${parseFloat(initialKilos)}, 0,
        ${userName || null}, 'in_progress'
      )
      RETURNING *
    `;

    // Registrar en log de movimientos
    await sql`
      INSERT INTO production_floor_movements_log (
        lot_id, area_from, area_to, kilos_moved, user_responsible, observations
      ) VALUES (
        ${lotId}, null, 'reception', ${parseFloat(initialKilos)}, 
        ${userName || null}, 'Inicialización de producción'
      )
    `;

    return NextResponse.json(floorEntry, { status: 201 });
  } catch (error) {
    console.error("Error initializing production floor map:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
