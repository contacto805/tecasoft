import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batchId');

    let details;
    if (batchId) {
      details = await sql`
        SELECT psd.*, bp.price_per_kg 
        FROM production_selection_details psd
        LEFT JOIN band_pricing bp ON psd.band_price IS NOT NULL
        WHERE psd.production_batch_id = ${parseInt(batchId)}
        ORDER BY psd.id
      `;
    } else {
      details = await sql`
        SELECT psd.*, bp.price_per_kg 
        FROM production_selection_details psd
        LEFT JOIN band_pricing bp ON psd.band_price IS NOT NULL
        ORDER BY psd.created_at DESC
      `;
    }

    return NextResponse.json(details);
  } catch (error) {
    console.error('Error fetching selection details:', error);
    return NextResponse.json(
      { error: 'Error fetching selection details' },
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
      boxes_per_pallet,
      caliber,
      class_name,
      boxes_10kg,
      boxes_6kg,
      band_price
    } = await request.json();

    if (!production_batch_id || !lot_id || !caliber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate total kg
    const totalKg = (parseInt(boxes_10kg || 0) * 10) + (parseInt(boxes_6kg || 0) * 6);

    // Get current band price if not provided
    let finalBandPrice = band_price;
    if (!finalBandPrice) {
      const pricingResult = await sql`
        SELECT price_per_kg FROM band_pricing 
        WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE
        LIMIT 1
      `;
      finalBandPrice = pricingResult.length > 0 ? pricingResult[0].price_per_kg : 0;
    }

    // Calculate total price
    const totalPrice = totalKg * finalBandPrice;

    const result = await sql`
      INSERT INTO production_selection_details (
        production_batch_id,
        lot_id,
        pallet_type,
        boxes_per_pallet,
        caliber,
        class_name,
        boxes_10kg,
        boxes_6kg,
        total_kg,
        band_price,
        total_price
      ) VALUES (
        ${parseInt(production_batch_id)},
        ${parseInt(lot_id)},
        ${pallet_type},
        ${parseInt(boxes_per_pallet) || 0},
        ${caliber},
        ${class_name || 'A'},
        ${parseInt(boxes_10kg) || 0},
        ${parseInt(boxes_6kg) || 0},
        ${totalKg},
        ${finalBandPrice},
        ${totalPrice}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating selection detail:', error);
    return NextResponse.json(
      { error: 'Error creating selection detail' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      boxes_10kg,
      boxes_6kg,
      class_name,
      band_price
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Selection detail ID required' },
        { status: 400 }
      );
    }

    // Calculate new total kg
    const totalKg = (parseInt(boxes_10kg || 0) * 10) + (parseInt(boxes_6kg || 0) * 6);
    const totalPrice = totalKg * (band_price || 0);

    const result = await sql`
      UPDATE production_selection_details
      SET 
        boxes_10kg = COALESCE(${boxes_10kg}, boxes_10kg),
        boxes_6kg = COALESCE(${boxes_6kg}, boxes_6kg),
        class_name = COALESCE(${class_name}, class_name),
        band_price = COALESCE(${band_price}, band_price),
        total_kg = ${totalKg},
        total_price = ${totalPrice},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating selection detail:', error);
    return NextResponse.json(
      { error: 'Error updating selection detail' },
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
        { error: 'Selection detail ID required' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM production_selection_details WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting selection detail:', error);
    return NextResponse.json(
      { error: 'Error deleting selection detail' },
      { status: 500 }
    );
  }
}
