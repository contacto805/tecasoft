import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API de Movimientos Diarios - Pérdidas y Ganancias
 * GET: Obtiene movimientos con filtros (fecha, tipo, categoría)
 * POST: Registra un nuevo movimiento (ingreso o egreso)
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const movementType = searchParams.get('movementType'); // 'INGRESO' o 'EGRESO'
    const category = searchParams.get('category');

    let whereConditions = sql``;
    
    if (startDate && endDate) {
      whereConditions = sql`WHERE movement_date >= ${startDate} AND movement_date <= ${endDate}`;
    } else if (startDate) {
      whereConditions = sql`WHERE movement_date >= ${startDate}`;
    } else if (endDate) {
      whereConditions = sql`WHERE movement_date <= ${endDate}`;
    }

    if (movementType && whereConditions.toString()) {
      whereConditions = sql`${whereConditions} AND movement_type = ${movementType}`;
    } else if (movementType) {
      whereConditions = sql`WHERE movement_type = ${movementType}`;
    }

    if (category) {
      if (whereConditions.toString()) {
        whereConditions = sql`${whereConditions} AND category = ${category}`;
      } else {
        whereConditions = sql`WHERE category = ${category}`;
      }
    }

    const movements = await sql`
      SELECT 
        id,
        movement_date,
        movement_type,
        category,
        description,
        amount,
        related_entity_type,
        related_entity_id,
        lot_id,
        currency,
        exchange_rate,
        amount_usd,
        notes,
        created_at
      FROM daily_movements
      ${whereConditions}
      ORDER BY movement_date DESC, created_at DESC
    `;

    return NextResponse.json(movements);
  } catch (error) {
    console.error('Error fetching daily movements:', error);
    return NextResponse.json(
      { error: 'Error al obtener movimientos: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      movementDate,
      movementType,
      category,
      description,
      amount,
      relatedEntityType,
      relatedEntityId,
      lotId,
      currency = 'MXN',
      exchangeRate = 1.0,
      notes
    } = await request.json();

    // Validaciones
    if (!movementDate || !movementType || !category || !amount) {
      return NextResponse.json(
        { error: 'Campos requeridos: movementDate, movementType, category, amount' },
        { status: 400 }
      );
    }

    if (!['INGRESO', 'EGRESO'].includes(movementType)) {
      return NextResponse.json(
        { error: 'movementType debe ser INGRESO o EGRESO' },
        { status: 400 }
      );
    }

    const amountUsd = currency === 'USD' ? amount : amount / exchangeRate;

    const result = await sql`
      INSERT INTO daily_movements (
        movement_date,
        movement_type,
        category,
        description,
        amount,
        related_entity_type,
        related_entity_id,
        lot_id,
        currency,
        exchange_rate,
        amount_usd,
        notes
      ) VALUES (
        ${movementDate},
        ${movementType},
        ${category},
        ${description || ''},
        ${parseFloat(amount)},
        ${relatedEntityType || null},
        ${relatedEntityId ? parseInt(relatedEntityId) : null},
        ${lotId ? parseInt(lotId) : null},
        ${currency},
        ${parseFloat(exchangeRate)},
        ${parseFloat(amountUsd)},
        ${notes || ''}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating daily movement:', error);
    return NextResponse.json(
      { error: 'Error al crear movimiento: ' + error.message },
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
        { error: 'ID de movimiento es requerido' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM daily_movements
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Movimiento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Movimiento eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting daily movement:', error);
    return NextResponse.json(
      { error: 'Error al eliminar movimiento: ' + error.message },
      { status: 500 }
    );
  }
}
