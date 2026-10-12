import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST - Record sale of process or waste
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      customer_id,
      sale_type, // 'process' or 'waste'
      caliber,
      quantity_kg,
      price_per_kg,
      sale_date,
      currency = 'MXN',
      notes
    } = body;

    if (!lot_id || !customer_id || !sale_type || !caliber || !quantity_kg || !price_per_kg) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (sale_type !== 'process' && sale_type !== 'waste') {
      return NextResponse.json(
        { error: "sale_type must be 'process' or 'waste'" },
        { status: 400 }
      );
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Get customer info
    const customer = await sql`SELECT * FROM customers WHERE id = ${customer_id}`;
    if (!customer.length) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const quantity = parseFloat(quantity_kg);
    const pricePerKg = parseFloat(price_per_kg);
    const totalAmount = quantity * pricePerKg;

    // Check inventory
    const table = sale_type === 'process' ? 'lot_process_inventory' : 'lot_waste_inventory';
    const inventory = await sql.raw(`
      SELECT total_kg FROM ${table}
      WHERE lot_id = ${lot_id} AND caliber = ${caliber}
    `);

    if (!inventory.length || parseFloat(inventory[0].total_kg) < quantity) {
      return NextResponse.json(
        { error: `Insufficient ${sale_type} inventory for caliber ${caliber}` },
        { status: 400 }
      );
    }

    // Deduct from inventory
    await sql.raw(`
      UPDATE ${table}
      SET total_kg = total_kg - ${quantity}
      WHERE lot_id = ${lot_id} AND caliber = ${caliber}
    `);

    // Create sale record
    const saleRecord = await sql`
      INSERT INTO sales_of_process_and_waste (
        lot_id,
        customer_id,
        product_name,
        process_kg,
        waste_kg,
        unit_price,
        total_price,
        date,
        notes,
        created_at
      )
      VALUES (
        ${lot_id},
        ${customer_id},
        ${sale_type === 'process' ? 'Proceso' : 'Desecho'},
        ${sale_type === 'process' ? quantity : 0},
        ${sale_type === 'waste' ? quantity : 0},
        ${pricePerKg},
        ${totalAmount},
        ${sale_date},
        ${notes},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    // Create entry in customer_trip_payments
    await sql`
      INSERT INTO customer_accounts (
        customer_id,
        trip_type,
        trip_reference_id,
        trip_date,
        description,
        amount_${currency.toLowerCase()},
        transaction_type,
        notes
      )
      VALUES (
        ${customer_id},
        ${sale_type},
        ${saleRecord[0].id},
        ${sale_date},
        ${'Sale of ' + sale_type},
        ${totalAmount},
        'receivable',
        ${notes || ''}
      )
    `;

    // Update lot totals
    if (sale_type === 'process') {
      await sql`
        UPDATE lots
        SET total_revenue = total_revenue + ${totalAmount}
        WHERE id = ${lot_id}
      `;
    } else {
      await sql`
        UPDATE lots
        SET total_revenue = total_revenue + ${totalAmount}
        WHERE id = ${lot_id}
      `;
    }

    return NextResponse.json(saleRecord[0]);
  } catch (error) {
    console.error("Error in POST /api/process-waste-sales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Fetch sales for a lot
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const saleType = searchParams.get('type');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    let query = sql`
      SELECT * FROM sales_of_process_and_waste
      WHERE lot_id = ${parseInt(lotId)}
    `;

    if (saleType === 'process') {
      query = sql`
        SELECT * FROM sales_of_process_and_waste
        WHERE lot_id = ${parseInt(lotId)} AND process_kg > 0
      `;
    } else if (saleType === 'waste') {
      query = sql`
        SELECT * FROM sales_of_process_and_waste
        WHERE lot_id = ${parseInt(lotId)} AND waste_kg > 0
      `;
    }

    const sales = await query;
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Error in GET /api/process-waste-sales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
