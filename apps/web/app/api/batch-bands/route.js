import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const producer = searchParams.get('producer');
    const broker = searchParams.get('broker');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (lotId) {
      const band = await sql`SELECT * FROM batch_bands WHERE id = ${parseInt(lotId)}`;
      return NextResponse.json(band);
    }

    let whereFragment = sql``;
    
    if (producer && broker && startDate && endDate) {
      whereFragment = sql`WHERE producer_name ILIKE ${'%' + producer + '%'} 
        AND broker_name ILIKE ${'%' + broker + '%'} 
        AND lot_date >= ${startDate} 
        AND lot_date <= ${endDate}`;
    } else if (producer && broker) {
      whereFragment = sql`WHERE producer_name ILIKE ${'%' + producer + '%'} 
        AND broker_name ILIKE ${'%' + broker + '%'}`;
    } else if (producer && startDate && endDate) {
      whereFragment = sql`WHERE producer_name ILIKE ${'%' + producer + '%'} 
        AND lot_date >= ${startDate} 
        AND lot_date <= ${endDate}`;
    } else if (broker && startDate && endDate) {
      whereFragment = sql`WHERE broker_name ILIKE ${'%' + broker + '%'} 
        AND lot_date >= ${startDate} 
        AND lot_date <= ${endDate}`;
    } else if (producer) {
      whereFragment = sql`WHERE producer_name ILIKE ${'%' + producer + '%'}`;
    } else if (broker) {
      whereFragment = sql`WHERE broker_name ILIKE ${'%' + broker + '%'}`;
    } else if (startDate && endDate) {
      whereFragment = sql`WHERE lot_date >= ${startDate} AND lot_date <= ${endDate}`;
    } else if (startDate) {
      whereFragment = sql`WHERE lot_date >= ${startDate}`;
    } else if (endDate) {
      whereFragment = sql`WHERE lot_date <= ${endDate}`;
    }

    const bands = await sql`SELECT * FROM batch_bands ${whereFragment} ORDER BY lot_date DESC, created_at DESC`;
    return NextResponse.json(bands);
  } catch (error) {
    console.error("Error fetching batch bands:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      lot_id,
      producer_name,
      broker_name,
      lot_date,
      lot_number,
      caliber,
      class_name,
      pallets_complete,
      boxes_96,
      boxes_156,
      total_kg,
      band_price,
      notes
    } = await request.json();

    if (!lot_id || !producer_name || !lot_date || !lot_number) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: lot_id, producer_name, lot_date, lot_number" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO batch_bands (
        lot_id, producer_name, broker_name, lot_date, lot_number,
        caliber, class_name, pallets_complete, boxes_96, boxes_156,
        total_kg, band_price, notes
      )
      VALUES (
        ${parseInt(lot_id)},
        ${producer_name},
        ${broker_name || null},
        ${lot_date},
        ${lot_number},
        ${caliber || null},
        ${class_name || 'A'},
        ${parseInt(pallets_complete) || 0},
        ${parseInt(boxes_96) || 0},
        ${parseInt(boxes_156) || 0},
        ${parseFloat(total_kg) || 0},
        ${parseFloat(band_price) || null},
        ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating batch band:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      producer_name,
      broker_name,
      lot_date,
      lot_number,
      caliber,
      class_name,
      pallets_complete,
      boxes_96,
      boxes_156,
      total_kg,
      band_price,
      notes
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID es requerido" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE batch_bands
      SET
        producer_name = ${producer_name},
        broker_name = ${broker_name || null},
        lot_date = ${lot_date},
        lot_number = ${lot_number},
        caliber = ${caliber || null},
        class_name = ${class_name || 'A'},
        pallets_complete = ${parseInt(pallets_complete) || 0},
        boxes_96 = ${parseInt(boxes_96) || 0},
        boxes_156 = ${parseInt(boxes_156) || 0},
        total_kg = ${parseFloat(total_kg) || 0},
        band_price = ${parseFloat(band_price) || null},
        notes = ${notes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating batch band:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "ID es requerido" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM batch_bands WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting batch band:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
