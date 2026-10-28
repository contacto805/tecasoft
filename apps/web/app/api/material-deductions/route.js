import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { production_batch_id, material_id, quantity_used, pallet_config_id } = await request.json();

    if (!production_batch_id || !material_id || quantity_used === undefined) {
      return NextResponse.json(
        { error: 'production_batch_id, material_id y quantity_used son requeridos' },
        { status: 400 }
      );
    }

    const qty = parseFloat(quantity_used);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Cantidad debe ser positiva' }, { status: 400 });
    }

    // Single consumption gate: check real stock (no silent max(0))
    const [material] = await sql`
      SELECT id, quantity_available, COALESCE(stock_min,0) as stock_min, COALESCE(costo_promedio, cost_per_unit, 0) as unit_cost 
      FROM materials_inventory WHERE id = ${parseInt(material_id)} LIMIT 1
    `;
    if (!material) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
    }

    const current = parseFloat(material.quantity_available || 0);
    const after = current - qty;
    if (after < 0) {
      return NextResponse.json({ 
        error: `Stock insuficiente. Actual: ${current.toFixed(2)}, requerido: ${qty.toFixed(2)}` 
      }, { status: 400 });
    }

    // Atomic update + record (single write)
    await sql`
      UPDATE materials_inventory
      SET quantity_available = ${after}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${material.id}
    `;

    const unitCost = parseFloat(material.unit_cost || 0);
    const [ded] = await sql`
      INSERT INTO material_deductions (
        production_batch_id, material_id, quantity_used, 
        costo_unitario_aplicado, costo_total, pallet_config_id
      )
      VALUES (
        ${parseInt(production_batch_id)}, ${material.id}, ${qty},
        ${unitCost}, ${qty * unitCost}, ${pallet_config_id || null}
      )
      RETURNING *
    `;

    return NextResponse.json(ded);
  } catch (error) {
    console.error('Error recording material deduction:', error);
    return NextResponse.json(
      { error: 'Error recording material deduction' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productionBatchId = searchParams.get('productionBatchId');

    if (productionBatchId) {
      const deductions = await sql`
        SELECT md.*, mi.material_name, mi.unit
        FROM material_deductions md
        JOIN materials_inventory mi ON md.material_id = mi.id
        WHERE md.production_batch_id = ${parseInt(productionBatchId)}
        ORDER BY md.created_at DESC
      `;
      return NextResponse.json(deductions);
    }

    const deductions = await sql`
      SELECT md.*, mi.material_name, mi.unit
      FROM material_deductions md
      JOIN materials_inventory mi ON md.material_id = mi.id
      ORDER BY md.created_at DESC
    `;
    return NextResponse.json(deductions);
  } catch (error) {
    console.error('Error fetching material deductions:', error);
    return NextResponse.json(
      { error: 'Error fetching material deductions' },
      { status: 500 }
    );
  }
}
