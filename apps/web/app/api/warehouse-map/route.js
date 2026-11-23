import {movePhysicalPallet} from "@/app/api/utils/pallet-location";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
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

    const currentState = await sql`
      SELECT p.id AS pallet_id, p.warehouse_slot AS slot_id, p.lot_id, p.caliber, p.class_name,
        p.total_kg AS kilos, l.lot_number, l.producer, p.estado AS status,
        CASE WHEN UPPER(COALESCE(p.ubicacion_actual,'')) LIKE 'TRAILER-%' THEN true ELSE false END AS reserved
      FROM pallet_output_summary p LEFT JOIN lots l ON l.id=p.lot_id
      WHERE UPPER(COALESCE(p.warehouse_slot,'')) ~ '^[ABC]-([1-9]|1[0-3])$'
        AND p.embarque_id IS NULL AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
      ORDER BY p.warehouse_slot
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
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
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

export async function DELETE(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:'Inicia sesión para mover tarimas.'},{status:401});
    const sourceSlot = new URL(request.url).searchParams.get('slotId');
    const {status,...result} = await movePhysicalPallet({sourceSlot,target:'PISO',allowTrailer:false,user});
    return NextResponse.json({success:status===200,...result},{status});
  } catch (error) {
    console.error('Liberación de frío:',error.message);
    return NextResponse.json({error:'No se pudo liberar la posición.'},{status:500});
  }
}
