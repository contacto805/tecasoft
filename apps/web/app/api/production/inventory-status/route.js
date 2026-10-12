import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category'); // optional filter

    let materials;
    
    if (category) {
      materials = await sql`
        SELECT 
          id,
          material_name,
          category,
          quantity_available,
          unit,
          minimum_stock,
          cost_per_unit,
          CASE 
            WHEN quantity_available < COALESCE(minimum_stock, 50) THEN 'low'
            ELSE 'ok'
          END as stock_status
        FROM materials_inventory
        WHERE category = ${category}
        ORDER BY category, material_name
      `;
    } else {
      materials = await sql`
        SELECT 
          id,
          material_name,
          category,
          quantity_available,
          unit,
          minimum_stock,
          cost_per_unit,
          CASE 
            WHEN quantity_available < COALESCE(minimum_stock, 50) THEN 'low'
            ELSE 'ok'
          END as stock_status
        FROM materials_inventory
        ORDER BY category, material_name
      `;
    }
    
    // Combine materials and field boxes
    const allInventory = [
      ...materials,
      { 
        material_name: 'Campo (Field Boxes)',
        category: 'Cajas de Campo',
        quantity_available: 0,
        unit: 'cajas',
        minimum_stock: 0,
        cost_per_unit: 0,
        stock_status: 'ok'
      }
    ];

    return NextResponse.json(allInventory);
  } catch (error) {
    console.error('Error fetching inventory status:', error);
    return NextResponse.json(
      { error: 'Error fetching inventory status' },
      { status: 500 }
    );
  }
}
