import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { logMovement } from "@/app/api/utils/recalculate";
import { recalculateLotPerformance } from "@/app/api/utils/recalculate";

// GET - Fetch production batches for a lot
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    // Get production batch info
    const batch = await sql`
      SELECT * FROM production_batches 
      WHERE lot_id = ${parseInt(lotId)}
      ORDER BY created_at DESC
    `;

    // Get production details (calibers)
    const details = await sql`
      SELECT * FROM production_selection_details 
      WHERE lot_id = ${parseInt(lotId)}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      batches: batch,
      details: details
    });
  } catch (error) {
    console.error("Error in GET /api/production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create production batch
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lot_id,
      production_date,
      caliber_data, // [{ caliber, class_name, process_kg, waste_kg, inventory_kg }, ...]
      material_deductions, // { material_id: quantity, ... }
      notes
    } = body;

    if (!lot_id || !caliber_data || !Array.isArray(caliber_data)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get lot info
    const lot = await sql`SELECT * FROM lots WHERE id = ${lot_id}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // SINGLE SOURCE: use canonical received kg (fruit_input_weighings.total_kg_weighed preferred)
    const { getCanonicalReceivedKg } = await import('@/app/api/utils/recalculate');
    const totalKgReceived = await getCanonicalReceivedKg(lot_id);

    // Full output validation: packed (inventory) + process + waste + shrinkage <= received
    const totalPacked = caliber_data.reduce((sum, item) => sum + (parseFloat(item.inventory_kg) || 0), 0);
    const totalProcess = caliber_data.reduce((sum, item) => sum + (parseFloat(item.process_kg) || 0), 0);
    const totalWaste = caliber_data.reduce((sum, item) => sum + (parseFloat(item.waste_kg) || 0), 0);
    const totalOutput = totalPacked + totalProcess + totalWaste;

    if (totalOutput > totalKgReceived + 0.5) { // small tolerance for rounding
      return NextResponse.json(
        { error: `Total salida (${totalOutput.toFixed(2)} kg) excede kg recibidos canónicos (${totalKgReceived.toFixed(2)} kg)` },
        { status: 400 }
      );
    }

    // Create production batch
    const batch = await sql`
      INSERT INTO production_batches (lot_id, production_date, status)
      VALUES (${lot_id}, ${production_date}, 'completed')
      RETURNING *
    `;

    // Insert caliber details and create inventory entries + central movements (ONE TIME only - no double increment)
    const packedDelta = parseFloat(caliber_data.reduce((sum, item) => sum + (parseFloat(item.inventory_kg) || 0), 0));
    const processDelta = parseFloat(caliber_data.reduce((sum, item) => sum + (parseFloat(item.process_kg) || 0), 0));
    const wasteDelta = parseFloat(caliber_data.reduce((sum, item) => sum + (parseFloat(item.waste_kg) || 0), 0));

    for (const caliber of caliber_data) {
      await sql`
        INSERT INTO production_selection_details (
          production_batch_id, lot_id, caliber, class_name, 
          process_kg, waste_kg, total_kg
        )
        VALUES (
          ${batch[0].id}, ${lot_id}, ${caliber.caliber}, ${caliber.class_name},
          ${parseFloat(caliber.process_kg) || 0}, ${parseFloat(caliber.waste_kg) || 0},
          ${parseFloat(caliber.inventory_kg) || 0}
        )
      `;

      if (parseFloat(caliber.inventory_kg) > 0) {
        // Idempotent insert or set exact (no += on repeat)
        await sql`
          INSERT INTO lot_inventory (lot_id, caliber, class_name, total_kg, creation_date)
          VALUES (${lot_id}, ${caliber.caliber}, ${caliber.class_name}, ${parseFloat(caliber.inventory_kg)}, CURRENT_DATE)
          ON CONFLICT (lot_id, caliber, class_name) DO NOTHING
        `;
        await sql`
          INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_name, module, reference, notes, created_at)
          VALUES ('production', ${batch[0].id}, ${lot_id}, 'PRODUCCION_EMPACADO', 0, ${parseFloat(caliber.inventory_kg)}, ${parseFloat(caliber.inventory_kg)}, 'kg', 'sistema', 'production', 'batch-'||${batch[0].id}, 'Calibre '||${caliber.caliber}||' clase '||${caliber.class_name||'A'}, CURRENT_TIMESTAMP)
        `;
      }

      if (parseFloat(caliber.process_kg) > 0) {
        await sql`
          INSERT INTO lot_process_inventory (lot_id, caliber, total_kg, creation_date)
          VALUES (${lot_id}, ${caliber.caliber}, ${parseFloat(caliber.process_kg)}, CURRENT_DATE)
          ON CONFLICT (lot_id, caliber) DO NOTHING
        `;
        await sql`
          INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_name, module, reference, notes, created_at)
          VALUES ('production', ${batch[0].id}, ${lot_id}, 'PRODUCCION_PROCESO', 0, ${parseFloat(caliber.process_kg)}, ${parseFloat(caliber.process_kg)}, 'kg', 'sistema', 'production', 'batch-'||${batch[0].id}, 'Proceso calibre '||${caliber.caliber}, CURRENT_TIMESTAMP)
        `;
      }

      if (parseFloat(caliber.waste_kg) > 0) {
        await sql`
          INSERT INTO lot_waste_inventory (lot_id, caliber, total_kg, creation_date)
          VALUES (${lot_id}, ${caliber.caliber}, ${parseFloat(caliber.waste_kg)}, CURRENT_DATE)
          ON CONFLICT (lot_id, caliber) DO NOTHING
        `;
        await sql`
          INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_name, module, reference, notes, created_at)
          VALUES ('production', ${batch[0].id}, ${lot_id}, 'PRODUCCION_DESECHO', 0, ${parseFloat(caliber.waste_kg)}, ${parseFloat(caliber.waste_kg)}, 'kg', 'sistema', 'production', 'batch-'||${batch[0].id}, 'Desecho calibre '||${caliber.caliber}, CURRENT_TIMESTAMP)
        `;
      }
    }

    if (material_deductions && typeof material_deductions === 'object') {
      for (const [materialId, quantity] of Object.entries(material_deductions)) {
        if (parseFloat(quantity) > 0) {
          const beforeMat = await sql`SELECT quantity_available FROM materials_inventory WHERE id = ${parseInt(materialId)} LIMIT 1`;
          const b = beforeMat.length ? parseFloat(beforeMat[0].quantity_available||0) : 0;
          await sql`UPDATE materials_inventory SET quantity_available = quantity_available - ${parseFloat(quantity)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(materialId)}`;
          await sql`
            INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, user_name, module, reference, notes, created_at)
            VALUES ('material', ${parseInt(materialId)}, ${lot_id}, 'CONSUMO_MATERIAL', ${b}, ${parseFloat(quantity)}, ${b - parseFloat(quantity)}, 'unidad', 'sistema', 'production', 'batch-'||${batch[0].id}, 'Material consumido en producción', CURRENT_TIMESTAMP)
          `;
        }
      }
    }

    // Rebuild from canonical sources instead of incremental +=
    const { recalculateLot } = await import('@/app/api/utils/recalculate');
    await recalculateLot(lot_id);

    await recalculateLotPerformance(lot_id);

    const newBatch = batch;
    const totalKg = (packedDelta || 0) + (processDelta || 0) + (wasteDelta || 0);
    await logMovement({ entity_type: 'production_batch', entity_id: newBatch[0].id, lot_id: lot_id, movement_type: 'PRODUCCION', qty: totalKg || 0, qty_after: totalKg || 0, module: 'produccion', reference: 'batch', notes: 'Producción registrada con trazabilidad central (recalc)' });

    return NextResponse.json({ success: true, batch: newBatch[0] });
  } catch (error) {
    console.error("Error in POST /api/production:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
