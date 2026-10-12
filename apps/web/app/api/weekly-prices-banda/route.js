import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener precios a la banda
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekHistoryId = searchParams.get('weekHistoryId');
    const weekNumber = searchParams.get('weekNumber');
    const weekYear = searchParams.get('weekYear');

    if (weekHistoryId) {
      const prices = await sql`
        SELECT * FROM weekly_prices_banda
        WHERE week_history_id = ${parseInt(weekHistoryId)}
        ORDER BY zone, fruit_type
      `;
      return NextResponse.json(prices);
    }

    if (weekNumber && weekYear) {
      const prices = await sql`
        SELECT * FROM weekly_prices_banda
        WHERE week_number = ${parseInt(weekNumber)} AND week_year = ${parseInt(weekYear)}
        ORDER BY zone, fruit_type
      `;
      return NextResponse.json(prices);
    }

    const prices = await sql`
      SELECT * FROM weekly_prices_banda
      ORDER BY week_year DESC, week_number DESC, zone, fruit_type
    `;
    
    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching banda prices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear precio a la banda
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weekHistoryId,
      weekNumber,
      weekYear,
      zone,
      fruitType,
      priceMin,
      priceMax,
      priceAverage,
      priceAuthorized,
      qualityConditions,
      volumeConditions,
      observations,
      createdBy
    } = body;

    if (!weekHistoryId || !weekNumber || !weekYear || !priceAuthorized) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO weekly_prices_banda (
        week_history_id, week_number, week_year, zone, fruit_type,
        price_min, price_max, price_average, price_authorized,
        quality_conditions, volume_conditions, observations, created_by
      ) VALUES (
        ${weekHistoryId}, ${weekNumber}, ${weekYear}, ${zone || null},
        ${fruitType || null}, ${priceMin || null}, ${priceMax || null},
        ${priceAverage || null}, ${priceAuthorized},
        ${qualityConditions || null}, ${volumeConditions || null},
        ${observations || null}, ${createdBy || null}
      ) RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating banda price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar precio a la banda
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const [result] = await sql`
      UPDATE weekly_prices_banda
      SET
        zone = COALESCE(${updateData.zone || null}, zone),
        fruit_type = COALESCE(${updateData.fruitType || null}, fruit_type),
        price_min = COALESCE(${updateData.priceMin || null}, price_min),
        price_max = COALESCE(${updateData.priceMax || null}, price_max),
        price_average = COALESCE(${updateData.priceAverage || null}, price_average),
        price_authorized = COALESCE(${updateData.priceAuthorized || null}, price_authorized),
        quality_conditions = COALESCE(${updateData.qualityConditions || null}, quality_conditions),
        volume_conditions = COALESCE(${updateData.volumeConditions || null}, volume_conditions),
        observations = COALESCE(${updateData.observations || null}, observations),
        status = COALESCE(${updateData.status || null}, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating banda price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar precio a la banda
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`DELETE FROM weekly_prices_banda WHERE id = ${parseInt(id)}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting banda price:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
