import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Fetch inventory for a lot
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    // Get inventory by caliber
    const inventoryByCalibrer = await sql`
      SELECT 
        caliber, 
        class_name, 
        SUM(total_kg) as total_kg,
        COUNT(*) as pallets
      FROM lot_inventory
      WHERE lot_id = ${parseInt(lotId)}
      GROUP BY caliber, class_name
      ORDER BY caliber ASC
    `;

    // Get process inventory
    const processInventory = await sql`
      SELECT 
        caliber,
        SUM(total_kg) as total_kg
      FROM lot_process_inventory
      WHERE lot_id = ${parseInt(lotId)}
      GROUP BY caliber
    `;

    // Get waste inventory
    const wasteInventory = await sql`
      SELECT 
        caliber,
        SUM(total_kg) as total_kg
      FROM lot_waste_inventory
      WHERE lot_id = ${parseInt(lotId)}
      GROUP BY caliber
    `;

    return NextResponse.json({
      inventory_by_caliber: inventoryByCalibrer,
      process_inventory: processInventory,
      waste_inventory: wasteInventory
    });
  } catch (error) {
    console.error("Error in GET /api/inventory:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update inventory (deduct on sale) - always creates central movement record for traceability
export async function PUT(request) {
  try {
    const body = await request.json();
    const { lot_id, caliber, quantity_sold, type = 'inventory', user_name = 'sistema', module = 'inventory' } = body;

    if (!lot_id || !caliber || !quantity_sold) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const quantity = parseFloat(quantity_sold);
    let tableName = 'lot_inventory';
    let movementType = 'SALIDA_VENTA';
    if (type === 'process') { tableName = 'lot_process_inventory'; movementType = 'SALIDA_PROCESO'; }
    else if (type === 'waste') { tableName = 'lot_waste_inventory'; movementType = 'SALIDA_DESECHO'; }

    // Get current (safe)
    const currentRows = await sql`SELECT total_kg FROM ${sql.identifier(tableName)} WHERE lot_id = ${parseInt(lot_id)} AND caliber = ${caliber} LIMIT 1`;
    if (!currentRows.length) {
      return NextResponse.json({ error: `No inventory found for caliber: ${caliber}` }, { status: 404 });
    }
    const before = parseFloat(currentRows[0].total_kg || 0);
    if (quantity > before) {
      return NextResponse.json({ error: `Insufficient inventory. Available: ${before} kg` }, { status: 400 });
    }

    const after = before - quantity;

    // Update safely
    await sql`UPDATE ${sql.identifier(tableName)} SET total_kg = ${after}, updated_at = CURRENT_TIMESTAMP WHERE lot_id = ${parseInt(lot_id)} AND caliber = ${caliber}`;

    // Record central movement for full traceability (ONE SOURCE OF TRUTH)
    await sql`
      INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_name, module, reference, notes, created_at)
      VALUES ('inventory', ${parseInt(lot_id)}, ${parseInt(lot_id)}, ${movementType}, ${before}, ${quantity}, ${after}, 'kg', ${user_name}, ${module}, 'venta-o-ajuste', 'Movimiento de inventario por calibre ' || ${caliber}, CURRENT_TIMESTAMP)
    `;

    // Also update lot aggregate for consistency (non-destructive)
    if (type === 'inventory') {
      await sql`UPDATE lots SET total_kg_inventory = COALESCE(total_kg_inventory,0) - ${quantity}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(lot_id)}`;
    }

    return NextResponse.json({ success: true, before, after, movement_logged: true });
  } catch (error) {
    console.error("Error in PUT /api/inventory:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
