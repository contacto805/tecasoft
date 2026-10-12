import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const producerName = searchParams.get('producerName');

    let whereConditions = sql``;

    if (status) {
      whereConditions = sql`WHERE payment_status = ${status}`;
    }

    if (producerName) {
      if (whereConditions.toString()) {
        whereConditions = sql`${whereConditions} AND producer_name ILIKE ${`%${producerName}%`}`;
      } else {
        whereConditions = sql`WHERE producer_name ILIKE ${`%${producerName}%`}`;
      }
    }

    const payments = await sql`
      SELECT 
        pp.*,
        l.lot_number,
        l.orchard_name,
        l.date as lot_date
      FROM producer_payments pp
      LEFT JOIN lots l ON pp.lot_id = l.id
      ${whereConditions}
      ORDER BY pp.scheduled_payment_date DESC, pp.created_at DESC
    `;

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching producer payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos a productores: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      lotId,
      producerName,
      totalKgReceived,
      fruitPricePerKg,
      scheduledPaymentDate,
      notes
    } = await request.json();

    if (!lotId || !producerName || !totalKgReceived || !fruitPricePerKg) {
      return NextResponse.json(
        { error: 'Campos requeridos: lotId, producerName, totalKgReceived, fruitPricePerKg' },
        { status: 400 }
      );
    }

    const totalAmount = parseFloat(totalKgReceived) * parseFloat(fruitPricePerKg);

    const result = await sql`
      INSERT INTO producer_payments (
        lot_id,
        producer_name,
        total_kg_received,
        fruit_price_per_kg,
        total_amount,
        payment_status,
        scheduled_payment_date,
        notes
      ) VALUES (
        ${parseInt(lotId)},
        ${producerName},
        ${parseFloat(totalKgReceived)},
        ${parseFloat(fruitPricePerKg)},
        ${totalAmount},
        'Pendiente',
        ${scheduledPaymentDate || null},
        ${notes || ''}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating producer payment:', error);
    return NextResponse.json(
      { error: 'Error al crear pago: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      paymentStatus,
      actualPaymentDate,
      paymentProofUrl,
      notes
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID de pago es requerido' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE producer_payments
      SET payment_status = ${paymentStatus || 'Pendiente'},
          actual_payment_date = ${actualPaymentDate || null},
          payment_proof_url = ${paymentProofUrl || null},
          notes = ${notes || ''},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      );
    }

    // Si se marca como pagado, registrar en movimientos diarios
    if (paymentStatus === 'Pagado' && actualPaymentDate) {
      const payment = result[0];
      
      // Verificar si ya existe el movimiento
      const existingMovement = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'producer_payment'
        AND related_entity_id = ${payment.id}
      `;

      if (existingMovement.length === 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id,
            lot_id
          ) VALUES (
            ${actualPaymentDate},
            'EGRESO',
            'Pago Productor',
            ${`Pago a ${payment.producer_name} - ${payment.total_kg_received} kg`},
            ${payment.total_amount},
            'producer_payment',
            ${payment.id},
            ${payment.lot_id}
          )
        `;
      }
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating producer payment:', error);
    return NextResponse.json(
      { error: 'Error al actualizar pago: ' + error.message },
      { status: 500 }
    );
  }
}
