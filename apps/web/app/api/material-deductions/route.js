import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { production_batch_id, material_id, quantity_used } = await request.json();

    if (!production_batch_id || !material_id || quantity_used === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Deduct from materials inventory
    const material = await sql`
      SELECT quantity_available FROM materials_inventory WHERE id = ${parseInt(material_id)}
    `;

    if (material.length === 0) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    const newQuantity = material[0].quantity_available - quantity_used;

    if (newQuantity < 0) {
      return NextResponse.json(
        { error: 'Insufficient material quantity' },
        { status: 400 }
      );
    }

    // Update material inventory
    await sql`
      UPDATE materials_inventory
      SET quantity_available = ${newQuantity},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(material_id)}
    `;

    // Record the deduction
    const result = await sql`
      INSERT INTO material_deductions (production_batch_id, material_id, quantity_used)
      VALUES (${parseInt(production_batch_id)}, ${parseInt(material_id)}, ${quantity_used})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
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
