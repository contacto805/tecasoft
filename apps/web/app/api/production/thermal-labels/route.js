import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batchId');

    let labels;
    if (batchId) {
      labels = await sql`
        SELECT tl.*, l.lot_number 
        FROM thermal_labels tl
        JOIN lots l ON tl.lot_id = l.id
        WHERE tl.production_batch_id = ${parseInt(batchId)}
        ORDER BY tl.id
      `;
    } else {
      labels = await sql`
        SELECT tl.*, l.lot_number 
        FROM thermal_labels tl
        JOIN lots l ON tl.lot_id = l.id
        ORDER BY tl.created_at DESC
      `;
    }

    return NextResponse.json(labels);
  } catch (error) {
    console.error('Error fetching thermal labels:', error);
    return NextResponse.json(
      { error: 'Error fetching thermal labels' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    let {
      production_batch_id,
      lot_id,
      lot_number,
      packing_date,
      cold_date,
      caliber,
      class_name,
      total_kg,
      auto_generate = false,
      pallets_complete,
      boxes_96,
      boxes_156,
      price_per_kg
    } = await request.json();

    if (!production_batch_id || !lot_id || !caliber) {
      return NextResponse.json(
        { error: 'Missing required fields: production_batch_id, lot_id, caliber' },
        { status: 400 }
      );
    }

    // Auto-generate lot number if requested
    if (auto_generate || !lot_number) {
      const sequenceResult = await sql`
        SELECT 
          COALESCE(MAX(CAST(SUBSTRING(lot_number FROM 4) AS INTEGER)), 0) as max_number
        FROM thermal_labels
        WHERE lot_number LIKE 'TL-%'
      `;

      const maxNumber = sequenceResult[0]?.max_number || 0;
      const nextNumber = maxNumber + 1;
      lot_number = `TL-${String(nextNumber).padStart(6, '0')}`;
    }

    // Validate lot_number is provided
    if (!lot_number || !lot_number.trim()) {
      return NextResponse.json(
        { error: 'Lot number is required or cannot be auto-generated' },
        { status: 400 }
      );
    }

    // Check for duplicate lot number
    const existingLabel = await sql`
      SELECT id FROM thermal_labels WHERE lot_number = ${lot_number.trim()}
    `;

    if (existingLabel.length > 0) {
      return NextResponse.json(
        { error: `El número de lote "${lot_number}" ya existe. Usa otro número o genera automáticamente.`, code: 'DUPLICATE_LOT_NUMBER' },
        { status: 409 }
      );
    }

    // Prepare label data
    const labelData = {
      lot_number,
      packing_date,
      cold_date,
      caliber,
      class_name: class_name || 'A',
      total_kg,
      printed_at: new Date().toISOString()
    };

    const result = await sql`
      INSERT INTO thermal_labels (
        production_batch_id,
        lot_id,
        lot_number,
        packing_date,
        cold_date,
        caliber,
        class_name,
        total_kg,
        label_data,
        pallets_complete,
        boxes_96,
        boxes_156,
        price_per_kg
      ) VALUES (
        ${parseInt(production_batch_id)},
        ${parseInt(lot_id)},
        ${lot_number.trim()},
        ${packing_date},
        ${cold_date},
        ${caliber},
        ${class_name || 'A'},
        ${total_kg || 0},
        ${JSON.stringify(labelData)},
        ${parseInt(pallets_complete) || 0},
        ${parseInt(boxes_96) || 0},
        ${parseInt(boxes_156) || 0},
        ${parseFloat(price_per_kg) || 0}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error creating thermal label:', error);
    return NextResponse.json(
      { error: 'Error creating thermal label: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      lot_number,
      caliber,
      class_name,
      total_kg,
      printed_count,
      pallets_complete,
      boxes_96,
      boxes_156,
      price_per_kg
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Thermal label ID required' },
        { status: 400 }
      );
    }

    // Get current label to check if lot_number is being changed
    const currentLabel = await sql`
      SELECT lot_number FROM thermal_labels WHERE id = ${id}
    `;

    if (currentLabel.length === 0) {
      return NextResponse.json(
        { error: 'Thermal label not found' },
        { status: 404 }
      );
    }

    // If lot_number is being changed, validate it's unique
    if (lot_number && lot_number !== currentLabel[0].lot_number) {
      const existingLabel = await sql`
        SELECT id FROM thermal_labels WHERE lot_number = ${lot_number.trim()} AND id != ${id}
      `;

      if (existingLabel.length > 0) {
        return NextResponse.json(
          { error: `El número de lote "${lot_number}" ya existe. Usa otro número.`, code: 'DUPLICATE_LOT_NUMBER' },
          { status: 409 }
        );
      }
    }

    const result = await sql`
      UPDATE thermal_labels
      SET 
        lot_number = COALESCE(${lot_number ? lot_number.trim() : null}, lot_number),
        caliber = COALESCE(${caliber || null}, caliber),
        class_name = COALESCE(${class_name || null}, class_name),
        total_kg = COALESCE(${total_kg !== undefined ? total_kg : null}, total_kg),
        printed_count = COALESCE(${printed_count}, printed_count),
        pallets_complete = COALESCE(${pallets_complete !== undefined ? pallets_complete : null}, pallets_complete),
        boxes_96 = COALESCE(${boxes_96 !== undefined ? boxes_96 : null}, boxes_96),
        boxes_156 = COALESCE(${boxes_156 !== undefined ? boxes_156 : null}, boxes_156),
        price_per_kg = COALESCE(${price_per_kg !== undefined ? price_per_kg : null}, price_per_kg),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating thermal label:', error);
    return NextResponse.json(
      { error: 'Error updating thermal label: ' + error.message },
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
        { error: 'Thermal label ID required' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM thermal_labels WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting thermal label:', error);
    return NextResponse.json(
      { error: 'Error deleting thermal label' },
      { status: 500 }
    );
  }
}
