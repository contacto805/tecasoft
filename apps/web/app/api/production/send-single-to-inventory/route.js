import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      thermal_label_id,
      lot_number,
      caliber,
      class_name,
      pallets_complete,
      boxes_96,
      boxes_156,
      total_kg,
      packing_date,
      cold_date,
      lot_id
    } = body;

    if (!thermal_label_id || !lot_number) {
      return NextResponse.json(
        { error: "thermal_label_id y lot_number son requeridos" },
        { status: 400 }
      );
    }

    // Correct semantics: production_batch_id must be the real production batch.
    // Store thermal_label_id separately for traceability.
    // Always create exactly 1 physical tarima row (pallet_count = 1).
    const [outputRecord] = await sql`
      INSERT INTO pallet_output_summary (
        production_batch_id,
        thermal_label_id,
        lot_id,
        pallet_type,
        caliber,
        class_name,
        pallet_count,
        total_kg,
        packing_date,
        cold_date,
        estado,
        folio_tarima,
        created_at,
        updated_at,
        version_registro
      ) VALUES (
        ${parseInt(production_batch_id) || null},
        ${parseInt(thermal_label_id) || null},
        ${lot_id || null},
        'Tarima',
        ${caliber || 'N/A'},
        ${class_name || 'A'},
        1,
        ${parseFloat(total_kg) || 0},
        ${packing_date || new Date().toISOString().split('T')[0]},
        ${cold_date || null},
        'PENDIENTE_UBICACION',
        ${'TAR-' + String(thermal_label_id || Date.now()).padStart(6,'0')},
        NOW(),
        NOW(),
        1
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `Tarima "${lot_number}" enviada exitosamente al inventario`,
      data: outputRecord
    });

  } catch (error) {
    console.error('Error enviando tarima al inventario:', error);
    return NextResponse.json(
      { error: error.message || 'Error enviando tarima al inventario' },
      { status: 500 }
    );
  }
}
