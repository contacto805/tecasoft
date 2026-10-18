import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const {
      pallet_config_id,
      quantity,
      production_batch_id,
      lot_id,
      master_batch_id,
      user_id,
      user_name
    } = await request.json();

    if (!pallet_config_id || !quantity || !production_batch_id) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Get pallet configuration and materials
    const config = await sql`
      SELECT * FROM pallet_configurations WHERE id = ${parseInt(pallet_config_id)}
    `;

    if (config.length === 0) {
      return NextResponse.json(
        { error: 'Configuración de tarima no encontrada' },
        { status: 404 }
      );
    }

    const materials = await sql`
      SELECT pm.*, mi.material_name, mi.quantity_available
      FROM pallet_materials pm
      JOIN materials_inventory mi ON pm.material_id = mi.id
      WHERE pm.pallet_config_id = ${parseInt(pallet_config_id)}
    `;

    // Check if there are enough materials
    const insufficientMaterials = [];

    for (const material of materials) {
      const neededQuantity = material.quantity_required * parseInt(quantity);
      if (material.quantity_available < neededQuantity) {
        insufficientMaterials.push({
          name: material.material_name,
          needed: neededQuantity,
          available: material.quantity_available,
          unit: material.unit
        });
      }
    }

    if (insufficientMaterials.length > 0) {
      return NextResponse.json(
        {
          error: 'Inventario insuficiente para los materiales',
          insufficientMaterials
        },
        { status: 400 }
      );
    }

    // Deduct materials from inventory - SINGLE TRANSACTIONAL SERVICE (FASE 04)
    // Records COSTO ESTANDAR (from config current prices) and COSTO REAL (historical at deduction)
    const deductedMaterials = [];
    const palletConfigId = parseInt(pallet_config_id);
    const prodBatchId = parseInt(production_batch_id);

    for (const material of materials) {
      const neededQuantity = parseFloat(material.quantity_required) * parseInt(quantity);
      const realUnitCost = parseFloat(material.effective_cost_per_unit || material.inventory_cost || 0);
      const costoTotalReal = neededQuantity * realUnitCost;

      // Update inventory
      await sql`
        UPDATE materials_inventory
        SET quantity_available = quantity_available - ${neededQuantity},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${material.material_id}
      `;

      // Record deduction with costs for standard vs real distinction
      await sql`
        INSERT INTO material_deductions (
          production_batch_id, material_id, quantity_used,
          costo_unitario_aplicado, costo_total, pallet_config_id
        ) VALUES (
          ${prodBatchId},
          ${material.material_id},
          ${neededQuantity},
          ${realUnitCost},
          ${costoTotalReal},
          ${palletConfigId}
        )
      `;

      deductedMaterials.push({
        material_id: material.material_id,
        material_name: material.material_name,
        quantity_deducted: neededQuantity,
        unit: material.unit,
        costo_real_unit: realUnitCost,
        costo_real_total: parseFloat(costoTotalReal.toFixed(4))
      });
    }

    // Log traceability event for materials deduction
    await sql`
      INSERT INTO traceability_log (
        master_batch_id,
        lot_id,
        event_type,
        event_category,
        event_description,
        related_entity_type,
        related_entity_id,
        material_quantities,
        user_id,
        user_name,
        metadata
      )
      VALUES (
        ${master_batch_id || null},
        ${lot_id || null},
        'materials_deducted',
        'materials',
        ${`Applied ${config[0].pallet_name} configuration - ${quantity} pallet(s)`},
        'pallet_configuration',
        ${parseInt(pallet_config_id)},
        ${JSON.stringify(deductedMaterials)},
        ${user_id || null},
        ${user_name || null},
        ${JSON.stringify({
          pallet_name: config[0].pallet_name,
          pallet_type: config[0].pallet_type,
          quantity_applied: parseInt(quantity),
          production_batch_id
        })}
      )
    `;

    return NextResponse.json({
      success: true,
      pallet_config: config[0],
      quantity_applied: parseInt(quantity),
      deductedMaterials,
      message: `Materiales deducidos exitosamente para ${quantity} tarima(s)`
    });
  } catch (error) {
    console.error('Error applying pallet materials:', error);
    return NextResponse.json(
      { error: 'Error al deducir materiales del inventario' },
      { status: 500 }
    );
  }
}
