import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { pallet_output_id, slot_id } = body;

    if (!pallet_output_id || !slot_id) {
      return NextResponse.json(
        { error: "pallet_output_id y slot_id son requeridos" },
        { status: 400 }
      );
    }

    // Update the pallet_output_summary with the warehouse slot location
    const [updatedRecord] = await sql`
      UPDATE pallet_output_summary
      SET 
        warehouse_slot = ${slot_id},
        ubicacion_actual = ${slot_id},
        estado = 'EN_FRIO',
        fecha_ubicacion = NOW(),
        version_registro = COALESCE(version_registro,1) + 1,
        updated_at = NOW()
      WHERE id = ${parseInt(pallet_output_id)}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `Tarima asignada exitosamente a la posición ${slot_id}`,
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
