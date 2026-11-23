import {movePhysicalPallet} from "@/app/api/utils/pallet-location";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const outputs = await sql`
        SELECT pos.*,
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer
        FROM pallet_output_summary pos
        LEFT JOIN lots l ON pos.lot_id = l.id
        WHERE pos.master_batch_id = ${parseInt(batchId)}
        ORDER BY pos.created_at DESC
      `;
      return NextResponse.json(outputs);
    }

    if (lotId) {
      const outputs = await sql`
        SELECT pos.*,
          COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
          COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
          l.lot_number, l.producer
        FROM pallet_output_summary pos
        LEFT JOIN lots l ON pos.lot_id = l.id
        WHERE pos.lot_id = ${parseInt(lotId)}
        ORDER BY pos.created_at DESC
      `;
      return NextResponse.json(outputs);
    }

    const outputs = await sql`
      SELECT pos.*,
        COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
        COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
        l.lot_number, l.producer
      FROM pallet_output_summary pos
      LEFT JOIN lots l ON pos.lot_id = l.id
      ORDER BY pos.created_at DESC
    `;

    return NextResponse.json(outputs);
  } catch (error) {
    console.error("Error fetching pallet outputs:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      production_batch_id,
      lot_id,
      pallet_type,
      caliber,
      class_name,
      pallet_count,
      total_kg,
      packing_date,
      cold_date,
      master_batch_id,
      user_id,
      user_name
    } = await request.json();

    if (!lot_id || !total_kg) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let batchId = master_batch_id;

    // Find active batch if not provided
    if (!batchId && lot_id) {
      const existingBatch = await sql`
        SELECT id FROM master_batches
        WHERE lot_id = ${lot_id}
        AND status IN ('received', 'processing')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
      }
    }

    // BLOCK 04: Physical traceability - Production declares pallets with canonical source + version (reprint increments version, NEVER new tarima)
    const sourceSystem = 'production';
    const versionRegistro = 1;
    const folioTarima = `TAR-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;

    // Idempotency / duplicate prevention: same batch + caliber + kg + date → return existing (no second tarima on retry or double click)
    const [dup] = await sql`
      SELECT * FROM pallet_output_summary
      WHERE lot_id = ${parseInt(lot_id)}
        AND COALESCE(production_batch_id,0) = ${parseInt(production_batch_id) || 0}
        AND COALESCE(caliber,'') = ${caliber || ''}
        AND ABS(COALESCE(total_kg,0) - ${parseFloat(total_kg)}) < 0.1
        AND COALESCE(estado,'') NOT IN ('CANCELADA')
      ORDER BY created_at DESC LIMIT 1
    `;
    if (dup) {
      return NextResponse.json({ ...dup, deduped: true, message: 'Tarima ya registrada (idempotencia)' });
    }

    const result = await sql`
      INSERT INTO pallet_output_summary (
        production_batch_id,
        lot_id,
        pallet_type,
        caliber,
        class_name,
        pallet_count,
        total_kg,
        packing_date,
        cold_date,
        master_batch_id,
        source_system,
        version_registro,
        folio_tarima,
        estado,
        ubicacion_actual
      )
      VALUES (
        ${production_batch_id || null},
        ${parseInt(lot_id)},
        ${pallet_type || null},
        ${caliber || null},
        ${class_name || null},
        ${pallet_count || 0},
        ${parseFloat(total_kg)},
        ${packing_date || null},
        ${cold_date || null},
        ${batchId || null},
        ${sourceSystem},
        ${versionRegistro},
        ${folioTarima},
        'PENDIENTE_UBICACION',
        null
      )
      RETURNING *
    `;

    // Update master batch inventory
    if (batchId) {
      const totalInventory = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM pallet_output_summary
        WHERE master_batch_id = ${batchId}
      `;

      const totalShipped = await sql`
        SELECT COALESCE(SUM(total_kg), 0) as total
        FROM load_history
        WHERE master_batch_id = ${batchId}
      `;

      const processed = parseFloat(totalInventory[0]?.total || 0);
      const shipped = parseFloat(totalShipped[0]?.total || 0);

      await sql`
        UPDATE master_batches
        SET
          total_kg_processed = ${processed},
          total_kg_in_inventory = ${processed - shipped},
          status = 'processing',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${batchId}
      `;

      // Material deduction happens at real consumption (production batch confirm / packing step), NOT here on pallet record or ship.
      // See /api/production/batches/.../confirm and /api/pallet-configurations/apply for the single consumption point.

      // Log traceability event
      await sql`
        INSERT INTO traceability_log (
          master_batch_id,
          lot_id,
          event_type,
          event_category,
          event_description,
          related_entity_type,
          related_entity_id,
          user_id,
          user_name,
          metadata
        )
        VALUES (
          ${batchId},
          ${parseInt(lot_id)},
          'pallet_output_recorded',
          'production',
          ${`Pallet output recorded - ${pallet_count} pallet(s), ${total_kg} kg`},
          'pallet_output',
          ${result[0].id},
          ${user_id || null},
          ${user_name || null},
          ${JSON.stringify({
            pallet_type,
            caliber,
            class_name,
            pallet_count,
            total_kg,
            packing_date,
            cold_date
          })}
        )
      `;
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating pallet output:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      pallet_count,
      total_kg,
      cold_date,
      action,
      new_ubicacion,
      embarque_id
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Pallet output ID required' },
        { status: 400 }
      );
    }

    if (action === 'reprint') {
      // BLOCK 04: Reprint does NOT create new tarima. Increment version only. Inventory/Embarques use same folio + version.
      const [current] = await sql`SELECT * FROM pallet_output_summary WHERE id = ${id} LIMIT 1`;
      if (!current) return NextResponse.json({ error: 'Tarima no encontrada' }, { status: 404 });

      const newVersion = (parseInt(current.version_registro || 1) || 1) + 1;
      const [updated] = await sql`
        UPDATE pallet_output_summary
        SET version_registro = ${newVersion}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      // Log print without new record
      await sql`
        INSERT INTO print_history (template_id, lot_id, printer_id, label_data, quantity_printed, printed_by, printed_at)
        VALUES (null, ${current.lot_id}, null, ${JSON.stringify({reprint: true, pallet_id: id, version: newVersion})}, 1, 'sistema', CURRENT_TIMESTAMP)
      `;
      return NextResponse.json({ ...updated, reprinted: true, new_version: newVersion });
    }

    if (action === 'locate') {
      const user = await getVerifiedErpUser();
      if (!user) return NextResponse.json({error:'Inicia sesión para mover tarimas.'},{status:401});
      const target = String(new_ubicacion || 'PISO').trim().toUpperCase();
      const {status,data,error} = await movePhysicalPallet({id,target,allowTrailer:false,user});
      return NextResponse.json(data || {error},{status});
    }

    if (action === 'ship') {
      const [updated] = await sql`
        UPDATE pallet_output_summary
        SET
          embarque_id = ${embarque_id || null},
          estado = 'EMBARCADA',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND embarque_id IS NULL
          AND UPPER(COALESCE(ubicacion_actual,'')) NOT LIKE 'TRAILER-%'
        RETURNING *
      `;
      return updated ? NextResponse.json(updated) :
        NextResponse.json({error:'La tarima está en un embarque o no se encuentra disponible.'},{status:409});
    }

    if (action === 'clear') {
      const user = await getVerifiedErpUser();
      if (!user) return NextResponse.json({error:'Inicia sesión para mover tarimas.'},{status:401});
      const {status,data,error} = await movePhysicalPallet({id,target:'PISO',allowTrailer:false,user});
      return NextResponse.json(data || {error},{status});
    }

    const result = await sql`
      UPDATE pallet_output_summary
      SET
        pallet_count = COALESCE(${pallet_count}, pallet_count),
        total_kg = COALESCE(${total_kg}, total_kg),
        cold_date = COALESCE(${cold_date}::date, cold_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating pallet output:', error);
    return NextResponse.json(
      { error: 'Error updating pallet output' },
      { status: 500 }
    );
  }
}

// Helper: deduct materials ONLY at real consumption step (production batch confirm / packing real use).
// NEVER call this again at shipping/embarque. Prohibits silent negative stock.
async function deductMaterialsForProduction(productionBatchId, palletCount, totalKg, strict = true) {
  try {
    if (!productionBatchId) return;

    // Materials consumption is declared at production confirmation time via pallet-config/apply or explicit material_deductions.
    // This helper now ONLY logs intent or applies if called from confirm path. No silent Math.max.
    // Example materials (real consumption registered via /api/pallet-configurations/apply or material-deductions at batch confirm)
    const materialsPerPallet = {
      'Cajas de Cartón': 40,
      'Tarimas': 1,
      'Etiquetas': 40,
    };

    for (const [materialName, quantityPerPallet] of Object.entries(materialsPerPallet)) {
      const totalQuantity = quantityPerPallet * (palletCount || 1);

      const material = await sql`
        SELECT id, quantity_available, COALESCE(stock_min,0) as stock_min
        FROM materials_inventory
        WHERE material_name = ${materialName} LIMIT 1
      `;
      if (material.length === 0) continue;

      const mat = material[0];
      const current = parseFloat(mat.quantity_available || 0);
      const after = current - totalQuantity;

      if (strict && after < 0) {
        throw new Error(`Stock insuficiente de ${materialName}: actual ${current}, requerido ${totalQuantity}`);
      }

      await sql`
        UPDATE materials_inventory
        SET quantity_available = ${Math.max(0, after)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${mat.id}
      `;

      await sql`
        INSERT INTO material_deductions (production_batch_id, material_id, quantity_used, costo_unitario_aplicado, costo_total)
        VALUES (${productionBatchId}, ${mat.id}, ${totalQuantity}, 0, 0)
        ON CONFLICT DO NOTHING
      `;
    }
  } catch (error) {
    console.error("Error deducting materials (strict):", error);
    if (strict) throw error; // surface so caller can block
  }
}
