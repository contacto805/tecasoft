import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener precios por gramaje
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekHistoryId = searchParams.get('weekHistoryId');
    const weekNumber = searchParams.get('weekNumber');
    const weekYear = searchParams.get('weekYear');

    if (weekHistoryId) {
      const prices = await sql`
        SELECT * FROM weekly_prices_by_gramaje
        WHERE week_history_id = ${parseInt(weekHistoryId)}
        ORDER BY category, gramaje
      `;
      return NextResponse.json(prices);
    }

    if (weekNumber && weekYear) {
      const prices = await sql`
        SELECT * FROM weekly_prices_by_gramaje
        WHERE week_number = ${parseInt(weekNumber)} AND week_year = ${parseInt(weekYear)}
        ORDER BY category, gramaje
      `;
      return NextResponse.json(prices);
    }

    const prices = await sql`
      SELECT * FROM weekly_prices_by_gramaje
      ORDER BY week_year DESC, week_number DESC, category, gramaje
    `;
    
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching gramaje prices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear precio por gramaje
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weekHistoryId,
      weekNumber,
      weekYear,
      zone,
      region,
      fruitType,
      category,
      gramaje,
      pricePerKg,
      currency,
      observations,
      createdBy
    } = body;

    if (!weekHistoryId || !weekNumber || !weekYear || !pricePerKg) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO weekly_prices_by_gramaje (
        week_history_id, week_number, week_year, zone, region,
        fruit_type, category, gramaje, price_per_kg, currency,
        observations, created_by
      ) VALUES (
        ${weekHistoryId}, ${weekNumber}, ${weekYear}, ${zone || null},
        ${region || null}, ${fruitType || null}, ${category || null},
        ${gramaje || null}, ${pricePerKg}, ${currency || 'MXN'},
        ${observations || null}, ${createdBy || null}
      ) RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating gramaje price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar precio por gramaje
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const [result] = await sql`
      UPDATE weekly_prices_by_gramaje
      SET
        zone = COALESCE(${updateData.zone || null}, zone),
        region = COALESCE(${updateData.region || null}, region),
        fruit_type = COALESCE(${updateData.fruitType || null}, fruit_type),
        category = COALESCE(${updateData.category || null}, category),
        gramaje = COALESCE(${updateData.gramaje || null}, gramaje),
        price_per_kg = COALESCE(${updateData.pricePerKg || null}, price_per_kg),
        currency = COALESCE(${updateData.currency || null}, currency),
        observations = COALESCE(${updateData.observations || null}, observations),
        status = COALESCE(${updateData.status || null}, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating gramaje price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar precio por gramaje
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`DELETE FROM weekly_prices_by_gramaje WHERE id = ${parseInt(id)}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gramaje price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
