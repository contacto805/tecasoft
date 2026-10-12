import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener todas las transacciones de un cliente o todas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const summary = searchParams.get("summary");

    // Si se pide el resumen de un cliente
    if (summary === "true" && customerId) {
      const transactions = await sql`
        SELECT * FROM customer_accounts 
        WHERE customer_id = ${parseInt(customerId)}
        ORDER BY trip_date DESC, created_at DESC
      `;

      let balanceUSD = 0;
      let balanceMXN = 0;

      transactions.forEach(t => {
        if (t.transaction_type === 'charge') {
          balanceUSD += parseFloat(t.amount_usd || 0);
          balanceMXN += parseFloat(t.amount_mxn || 0);
        } else if (t.transaction_type === 'payment') {
          balanceUSD -= parseFloat(t.amount_usd || 0);
          balanceMXN -= parseFloat(t.amount_mxn || 0);
        }
      });

      return NextResponse.json({
        transactions,
        balanceUSD,
        balanceMXN
      });
    }

    // Si se pide por cliente específico
    if (customerId) {
      const transactions = await sql`
        SELECT * FROM customer_accounts 
        WHERE customer_id = ${parseInt(customerId)}
        ORDER BY trip_date DESC, created_at DESC
      `;
      return NextResponse.json(transactions);
    }

    // Todas las transacciones
    const transactions = await sql`
      SELECT ca.*, c.customer_name 
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      ORDER BY ca.trip_date DESC, ca.created_at DESC
    `;
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching customer accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: crear una nueva transacción (cargo o abono)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerId,
      tripType,
      tripReferenceId,
      tripDate,
      description,
      amountUSD,
      amountMXN,
      transactionType,
      exchangeRate,
      notes
    } = body;

    const result = await sql`
      INSERT INTO customer_accounts (
        customer_id, trip_type, trip_reference_id, trip_date, 
        description, amount_usd, amount_mxn, transaction_type,
        exchange_rate, notes
      ) VALUES (
        ${parseInt(customerId)}, ${tripType || null}, ${tripReferenceId || null}, 
        ${tripDate}, ${description || null}, ${parseFloat(amountUSD) || 0}, 
        ${parseFloat(amountMXN) || 0}, ${transactionType}, 
        ${parseFloat(exchangeRate) || null}, ${notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating customer account transaction:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: actualizar una transacción existente
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      tripType,
      tripDate,
      description,
      amountUSD,
      amountMXN,
      transactionType,
      exchangeRate,
      notes
    } = body;

    const result = await sql`
      UPDATE customer_accounts SET
        trip_type = ${tripType || null},
        trip_date = ${tripDate},
        description = ${description || null},
        amount_usd = ${parseFloat(amountUSD) || 0},
        amount_mxn = ${parseFloat(amountMXN) || 0},
        transaction_type = ${transactionType},
        exchange_rate = ${parseFloat(exchangeRate) || null},
        notes = ${notes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating customer account transaction:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: eliminar una transacción
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    await sql`DELETE FROM customer_accounts WHERE id = ${parseInt(id)}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting customer account transaction:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
