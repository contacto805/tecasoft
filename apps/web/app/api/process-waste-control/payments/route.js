import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * GET: List payments for a sale
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId");

    if (!saleId) {
      return NextResponse.json(
        { error: "saleId es requerido" },
        { status: 400 }
      );
    }

    const payments = await sql`
      SELECT * FROM process_waste_payments
      WHERE sale_id = ${parseInt(saleId)}
      ORDER BY payment_date DESC
    `;

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Register payment for an approved sale
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      saleId, paymentDate, paymentMethod, referenceNumber,
      amountReceived, receiptUrl, observations, registeredBy
    } = body;

    // Verify sale is approved
    const [sale] = await sql`
      SELECT * FROM process_waste_sales WHERE id = ${parseInt(saleId)}
    `;

    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (sale.status !== 'aprobado') {
      return NextResponse.json(
        { error: "Solo se pueden registrar pagos para ventas aprobadas" },
        { status: 400 }
      );
    }

    // Get total paid so far
    const totalPaidResult = await sql`
      SELECT COALESCE(SUM(amount_received), 0) as total_paid
      FROM process_waste_payments
      WHERE sale_id = ${parseInt(saleId)}
    `;

    const totalPaid = parseFloat(totalPaidResult[0].total_paid);
    const newTotal = totalPaid + parseFloat(amountReceived);

    if (newTotal > parseFloat(sale.total_amount)) {
      return NextResponse.json(
        { error: "El monto total de pagos excede el monto de la venta" },
        { status: 400 }
      );
    }

    // Register payment
    const result = await sql`
      INSERT INTO process_waste_payments (
        sale_id, payment_date, payment_method, reference_number,
        amount_received, receipt_url, observations, registered_by
      ) VALUES (
        ${parseInt(saleId)}, ${paymentDate}, ${paymentMethod},
        ${referenceNumber || null}, ${parseFloat(amountReceived)},
        ${receiptUrl || null}, ${observations || null}, ${registeredBy}
      )
      RETURNING *
    `;

    // Update payment status on sale
    let paymentStatus = 'parcial';
    if (newTotal >= parseFloat(sale.total_amount)) {
      paymentStatus = 'pagado';
    }

    await sql`
      UPDATE process_waste_sales SET
        payment_status = ${paymentStatus},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(saleId)}
    `;

    // TODO: Register in cash flow / caja only if payment is complete

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error registering payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
