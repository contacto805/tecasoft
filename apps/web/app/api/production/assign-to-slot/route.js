import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Cold room positions: A1-A13, B1-B13, C1-C13 (39 physical slots)
const VALID_SLOT_REGEX = /^[ABC]-\d{1,2}$/i;

export async function POST(request) {
  try {
    const body = await request.json();
    const { pallet_output_id, slot_id, forceOverwrite = false } = body;

    if (!pallet_output_id || !slot_id) {
      return NextResponse.json(
        { error: "pallet_output_id y slot_id son requeridos" },
        { status: 400 }
      );
    }

    const slot = String(slot_id).toUpperCase().trim();
    if (!VALID_SLOT_REGEX.test(slot)) {
      return NextResponse.json({ error: "Posición inválida. Use formato A-1 a C-13 (39 posiciones de cuarto frío)" }, { status: 400 });
    }

    const palletId = parseInt(pallet_output_id);

    // Validate pallet exists and is not already shipped
    const [pallet] = await sql`
      SELECT id, lot_id, total_kg, estado, warehouse_slot, ubicacion_actual, folio_tarima
      FROM pallet_output_summary 
      WHERE id = ${palletId} LIMIT 1
    `;
    if (!pallet) {
      return NextResponse.json({ error: "Tarima no encontrada" }, { status: 404 });
    }
    if (['EMBARCADA', 'CANCELADA'].includes(String(pallet.estado || '').toUpperCase())) {
      return NextResponse.json({ error: "Tarima ya embarcada o cancelada. No se puede reubicar." }, { status: 400 });
    }

    // Concurrency / exclusive occupation check: one tarima per physical slot at a time (source: pallet_output_summary)
    const [currentOccupant] = await sql`
      SELECT id, folio_tarima, lot_id, caliber, class_name 
      FROM pallet_output_summary 
      WHERE UPPER(COALESCE(warehouse_slot, ubicacion_actual, '')) = ${slot}
        AND id != ${palletId}
        AND COALESCE(estado, 'PENDIENTE_UBICACION') NOT IN ('EMBARCADA', 'CANCELADA')
      LIMIT 1
    `;
    if (currentOccupant && !forceOverwrite) {
      return NextResponse.json({ 
        error: `Posición ${slot} ya ocupada por tarima ${currentOccupant.folio_tarima || currentOccupant.id}`,
        occupant: currentOccupant
      }, { status: 409 });
    }

    // Transactional assign (update only this pallet)
    const [updatedRecord] = await sql`
      UPDATE pallet_output_summary
      SET 
        warehouse_slot = ${slot},
        ubicacion_actual = ${slot},
        estado = 'EN_FRIO',
        fecha_ubicacion = NOW(),
        version_registro = COALESCE(version_registro, 1) + 1,
        updated_at = NOW()
      WHERE id = ${palletId}
      RETURNING *
    `;

    // Optional audit in warehouse_map_movements for history (non-blocking)
    try {
      await sql`
        INSERT INTO warehouse_map_movements (slot_id, lot_id, caliber, class_name, boxes, kilos, movement_type, user_id, user_name, notes, moved_at)
        VALUES (${slot}, ${pallet.lot_id || null}, ${pallet.caliber || null}, ${pallet.class_name || null}, NULL, ${parseFloat(pallet.total_kg||0)}, 'assign', NULL, NULL, ${'Asignación desde producción: ' + (pallet.folio_tarima || palletId)}, NOW())
      `;
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `Tarima asignada a posición ${slot} (concurrencia validada)`,
      data: updatedRecord
    });

  } catch (error) {
    console.error('Error asignando tarima a posición:', error);
    return NextResponse.json(
      { error: error.message || 'Error asignando tarima a posición' },
      { status: 500 }
    );
  }
}
