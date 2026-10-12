import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let whereConditions = sql``;

    if (status) {
      whereConditions = sql`WHERE ff.status = ${status}`;
    }

    if (startDate) {
      if (whereConditions.toString()) {
        whereConditions = sql`${whereConditions} AND ff.freight_date >= ${startDate}`;
      } else {
        whereConditions = sql`WHERE ff.freight_date >= ${startDate}`;
      }
    }

    if (endDate) {
      if (whereConditions.toString()) {
        whereConditions = sql`${whereConditions} AND ff.freight_date <= ${endDate}`;
      } else {
        whereConditions = sql`WHERE ff.freight_date <= ${endDate}`;
      }
    }

    const freights = await sql`
      SELECT 
        ff.*,
        l.lot_number,
        lh.customer_name,
        lh.destination,
        lh.total_kg
      FROM foreign_freights ff
      LEFT JOIN lots l ON ff.lot_id = l.id
      LEFT JOIN load_history lh ON ff.load_id = lh.id
      ${whereConditions}
      ORDER BY ff.freight_date DESC, ff.created_at DESC
    `;

    return NextResponse.json(freights);
  } catch (error) {
    console.error('Error fetching foreign freights:', error);
    return NextResponse.json(
      { error: 'Error al obtener fletes: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      loadId,
      lotId,
      driverName,
      truckPlates,
      trailerPlates,
      freightDate,
      freightAmount,
      notes,
      credit_days,
      amount_paid
    } = await request.json();

    if (!driverName || !freightDate || !freightAmount) {
      return NextResponse.json(
        { error: 'Campos requeridos: driverName (transportista), freightDate, freightAmount (precio pactado)' },
        { status: 400 }
      );
    }

    const fd = freightDate;
    const crDays = parseInt(credit_days) || 0;
    let calcDue = null;
    if (crDays >= 0) {
      const d = new Date(fd);
      d.setDate(d.getDate() + crDays);
      calcDue = d.toISOString().split("T")[0];
    }

    const amountPactado = parseFloat(freightAmount);
    const paidInit = parseFloat(amount_paid) || 0;
    const statusInit = paidInit >= amountPactado ? "Pagado" : (paidInit > 0 ? "Parcial" : "Pendiente");

    const result = await sql`
      INSERT INTO foreign_freights (
        load_id,
        lot_id,
        driver_name,
        truck_plates,
        trailer_plates,
        freight_date,
        freight_amount,
        payment_date,
        status,
        notes,
        credit_days,
        due_date,
        amount_paid,
        payment_status
      ) VALUES (
        ${loadId ? parseInt(loadId) : null},
        ${lotId ? parseInt(lotId) : null},
        ${driverName},
        ${truckPlates || ''},
        ${trailerPlates || ''},
        ${fd},
        ${amountPactado},
        null,
        ${statusInit},
        ${notes || ''},
        ${crDays},
        ${calcDue},
        ${paidInit},
        ${statusInit}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating foreign freight:', error);
    return NextResponse.json(
      { error: 'Error al crear flete: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      status,
      paymentDate,
      notes,
      credit_days,
      amount_paid,
      driver_name,
      freight_amount,
      truck_plates,
      due_date
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID de flete es requerido' },
        { status: 400 }
      );
    }

    const fId = parseInt(id);
    const [existing] = await sql`SELECT * FROM foreign_freights WHERE id = ${fId}`;
    if (!existing) return NextResponse.json({ error: "Flete no encontrado" }, { status: 404 });

    const newCredit = (credit_days !== undefined) ? parseInt(credit_days) : existing.credit_days;
    const baseDate = paymentDate || existing.freight_date;
    let newDue = due_date || existing.due_date;

    if (credit_days !== undefined && baseDate) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + Math.max(0, newCredit || 0));
      newDue = d.toISOString().split("T")[0];
    }

    const pactado = (freight_amount !== undefined) ? parseFloat(freight_amount) : parseFloat(existing.freight_amount);
    const paid = (amount_paid !== undefined) ? parseFloat(amount_paid) : parseFloat(existing.amount_paid || 0);
    const computedSaldo = Math.max(0, pactado - paid);
    let payStatus = status || existing.payment_status || 'Pendiente';
    if (paid >= pactado) payStatus = 'Pagado';
    else if (paid > 0) payStatus = 'Parcial';
    else payStatus = 'Pendiente';

    const result = await sql`
      UPDATE foreign_freights
      SET 
        status = ${payStatus},
        payment_date = ${paymentDate || existing.payment_date || null},
        notes = ${notes !== undefined ? notes : existing.notes},
        driver_name = ${driver_name !== undefined ? driver_name : existing.driver_name},
        freight_amount = ${pactado},
        truck_plates = ${truck_plates !== undefined ? truck_plates : existing.truck_plates},
        credit_days = ${newCredit},
        due_date = ${newDue},
        amount_paid = ${paid},
        payment_status = ${payStatus},
        updated_at = NOW()
      WHERE id = ${fId}
      RETURNING *
    `;

    const updated = result[0];

    // Audit: simple log
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, old_value, new_value, description)
      VALUES ('web', 'Usuario', 'fletes', 'update', 'foreign_freight', ${fId}, 
        ${JSON.stringify({ amount: existing.freight_amount, paid: existing.amount_paid, status: existing.payment_status })},
        ${JSON.stringify({ amount: updated.freight_amount, paid: updated.amount_paid, status: updated.payment_status })},
        ${'Actualización de flete / pago'})
    `;

    // Movement when fully paid
    if (payStatus === 'Pagado' && !existing.payment_date && baseDate) {
      const existsMv = await sql`SELECT id FROM daily_movements WHERE related_entity_type='foreign_freight' AND related_entity_id=${fId}`;
      if (!existsMv.length) {
        await sql`
          INSERT INTO daily_movements (movement_date, movement_type, category, description, amount, related_entity_type, related_entity_id, lot_id)
          VALUES (${baseDate}, 'EGRESO', 'Flete Foráneo', ${`Flete - ${updated.driver_name} - ${updated.truck_plates || ''}`}, ${pactado}, 'foreign_freight', ${fId}, ${updated.lot_id});
        `;
      }
    }

    return NextResponse.json({ ...updated, saldo: computedSaldo });
  } catch (error) {
    console.error('Error updating foreign freight:', error);
    return NextResponse.json(
      { error: 'Error al actualizar flete: ' + error.message },
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
        { error: 'ID de flete es requerido' },
        { status: 400 }
      );
    }

    // Eliminar movimiento relacionado si existe
    await sql`
      DELETE FROM daily_movements
      WHERE related_entity_type = 'foreign_freight'
      AND related_entity_id = ${parseInt(id)}
    `;

    const result = await sql`
      DELETE FROM foreign_freights
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Flete no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Flete eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting foreign freight:', error);
    return NextResponse.json(
      { error: 'Error al eliminar flete: ' + error.message },
      { status: 500 }
    );
  }
}
