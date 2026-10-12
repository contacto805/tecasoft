import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * GET: List all process/waste sales with filters
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const weekStartDate = searchParams.get("weekStartDate");
    const saleType = searchParams.get("saleType");

    let query = sql`SELECT * FROM process_waste_sales WHERE 1=1`;
    let filters = [];

    if (status) {
      filters.push(sql` AND status = ${status}`);
    }

    if (weekStartDate) {
      filters.push(sql` AND week_start_date = ${weekStartDate}`);
    }

    if (saleType) {
      filters.push(sql` AND sale_type = ${saleType}`);
    }

    // Combine base query with filters
    if (filters.length > 0) {
      let combinedQuery = sql`SELECT * FROM process_waste_sales WHERE 1=1`;
      for (const filter of filters) {
        combinedQuery = sql`${combinedQuery}${filter}`;
      }
      const sales = await combinedQuery;
      return NextResponse.json(sales);
    }

    const sales = await sql`SELECT * FROM process_waste_sales ORDER BY created_at DESC`;
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Error fetching process/waste sales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Create new process/waste sale request
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weekStartDate, weekEndDate, saleDate, saleType, customerName, buyerName,
      kgAvailableSource, kgSold, pricePerKg, observations, requestedBy
    } = body;

    // Validate kg sold doesn't exceed available
    if (parseFloat(kgSold) > parseFloat(kgAvailableSource)) {
      return NextResponse.json(
        { error: "Los kg vendidos no pueden exceder los kg disponibles" },
        { status: 400 }
      );
    }

    const totalAmount = parseFloat(kgSold) * parseFloat(pricePerKg);

    // Generate folio
    const now = new Date();
    const folio = `PW-${saleType.toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const result = await sql`
      INSERT INTO process_waste_sales (
        folio, week_start_date, week_end_date, sale_date, sale_type,
        customer_name, buyer_name, kg_available_source, kg_sold,
        price_per_kg, total_amount, observations, status,
        requested_by, requested_at
      ) VALUES (
        ${folio}, ${weekStartDate}, ${weekEndDate}, ${saleDate}, ${saleType},
        ${customerName}, ${buyerName || null}, ${parseFloat(kgAvailableSource)},
        ${parseFloat(kgSold)}, ${parseFloat(pricePerKg)}, ${totalAmount},
        ${observations || null}, 'pendiente', ${requestedBy}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    // Log the creation
    await sql`
      INSERT INTO process_waste_authorization_log (
        sale_id, action, user_id, user_name, old_status, new_status, reason
      ) VALUES (
        ${result[0].id}, 'created', ${requestedBy}, ${requestedBy},
        NULL, 'pendiente', 'Solicitud creada'
      )
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating process/waste sale:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Update sale status (approve/reject)
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, action, userId, userName, reason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: "Acción inválida. Debe ser 'approve' o 'reject'" },
        { status: 400 }
      );
    }

    // Get current sale
    const [currentSale] = await sql`
      SELECT * FROM process_waste_sales WHERE id = ${parseInt(id)}
    `;

    if (!currentSale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (currentSale.status !== 'pendiente') {
      return NextResponse.json(
        { error: "Solo se pueden aprobar/rechazar ventas pendientes" },
        { status: 400 }
      );
    }

    let result;
    if (action === 'approve') {
      result = await sql`
        UPDATE process_waste_sales SET
          status = 'aprobado',
          approved_by = ${userName},
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;

      // Log approval
      await sql`
        INSERT INTO process_waste_authorization_log (
          sale_id, action, user_id, user_name, old_status, new_status, reason
        ) VALUES (
          ${parseInt(id)}, 'approved', ${userId}, ${userName},
          'pendiente', 'aprobado', ${reason || 'Aprobado por superadministrador'}
        )
      `;
    } else {
      result = await sql`
        UPDATE process_waste_sales SET
          status = 'rechazado',
          rejected_by = ${userName},
          rejected_at = CURRENT_TIMESTAMP,
          rejection_reason = ${reason || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;

      // Log rejection
      await sql`
        INSERT INTO process_waste_authorization_log (
          sale_id, action, user_id, user_name, old_status, new_status, reason
        ) VALUES (
          ${parseInt(id)}, 'rejected', ${userId}, ${userName},
          'pendiente', 'rechazado', ${reason || 'Rechazado por superadministrador'}
        )
      `;
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating sale status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Cancel a pending sale
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const [currentSale] = await sql`
      SELECT * FROM process_waste_sales WHERE id = ${parseInt(id)}
    `;

    if (!currentSale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (currentSale.status !== 'pendiente') {
      return NextResponse.json(
        { error: "Solo se pueden eliminar ventas pendientes" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM process_waste_sales WHERE id = ${parseInt(id)}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sale:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
