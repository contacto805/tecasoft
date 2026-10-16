import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batchId');

    let output;
    if (batchId) {
      output = await sql`
        SELECT pos.*, 
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer 
        FROM pallet_output_summary pos
        JOIN lots l ON pos.lot_id = l.id
        WHERE pos.production_batch_id = ${parseInt(batchId)}
        ORDER BY pos.id
      `;
    } else {
      output = await sql`
        SELECT pos.*, 
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer 
        FROM pallet_output_summary pos
        JOIN lots l ON pos.lot_id = l.id
        ORDER BY pos.created_at DESC
      `;
    }

    return NextResponse.json(output);
  } catch (error) {
    console.error('Error fetching pallet output:', error);
    return NextResponse.json(
      { error: 'Error fetching pallet output' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      production_batch_id,
      lot_id,
      pallet_type,
      caliber,
      class_name,
      pallet_count,
      total_kg,
      packing_date,
      cold_date
    } = await request.json();

    if (!production_batch_id || !lot_id || !caliber || pallet_count === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // BLOCK 04: Production declares with source + version. Inventory receives/locates. Embarques confirms salida. Reprint = version++ only.
    const sourceSystem = 'production';
    const versionRegistro = 1;
    const folioTarima = `TAR-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;

    const result = await sql`
      INSERT INTO pallet_output_summary (
        production_batch_id,
        lot_id,
        pallet_type,
        caliber,
        class_name,
        pallet_count,
        total_kg,
        packing_date,
        cold_date,
        source_system,
        version_registro,
        folio_tarima,
        estado
      ) VALUES (
        ${parseInt(production_batch_id)},
        ${parseInt(lot_id)},
        ${pallet_type},
        ${caliber},
        ${class_name || 'A'},
        ${parseInt(pallet_count)},
        ${total_kg || 0},
        ${packing_date},
        ${cold_date},
        ${sourceSystem},
        ${versionRegistro},
        ${folioTarima},
        'PENDIENTE_UBICACION'
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating pallet output:', error);
    return NextResponse.json(
      { error: 'Error creating pallet output' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      pallet_count,
      total_kg,
      cold_date
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Pallet output ID required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE pallet_output_summary
      SET 
        pallet_count = COALESCE(${pallet_count}, pallet_count),
        total_kg = COALESCE(${total_kg}, total_kg),
        cold_date = COALESCE(${cold_date}::date, cold_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating pallet output:', error);
    return NextResponse.json(
      { error: 'Error updating pallet output' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Pallet output ID required' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM pallet_output_summary WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pallet output:', error);
    return NextResponse.json(
      { error: 'Error deleting pallet output' },
      { status: 500 }
    );
  }
}
