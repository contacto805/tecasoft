import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { 
      lot_id, 
      materials_used, // Array of { material_id, quantity }
      packed_boxes_count,
      production_date,
      field_boxes_returned // Number of field boxes to return to inventory
    } = await request.json();

    if (!lot_id || !Array.isArray(materials_used) || !packed_boxes_count) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Start transaction - create production batch
    const batchResult = await sql`
      INSERT INTO production_batches (lot_id, packed_boxes_count, production_date, status)
      VALUES (${parseInt(lot_id)}, ${parseInt(packed_boxes_count)}, ${production_date}, 'In Progress')
      RETURNING *
    `;

    const batch = batchResult[0];

    // Deduct materials from inventory
    for (const material of materials_used) {
      // Get current material quantity
      const matData = await sql`
        SELECT quantity_available FROM materials_inventory WHERE id = ${parseInt(material.material_id)}
      `;

      if (matData.length === 0) {
        throw new Error(`Material with ID ${material.material_id} not found`);
      }

      const currentQty = matData[0].quantity_available;
      const newQty = currentQty - material.quantity;

      if (newQty < 0) {
        throw new Error(`Insufficient quantity for material ID ${material.material_id}`);
      }

      // Update material inventory
      await sql`
        UPDATE materials_inventory
        SET quantity_available = ${newQty}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(material.material_id)}
      `;

      // Record deduction
      await sql`
        INSERT INTO material_deductions (production_batch_id, material_id, quantity_used)
        VALUES (${batch.id}, ${parseInt(material.material_id)}, ${material.quantity})
      `;
    }

    // Return field boxes to inventory if specified
    if (field_boxes_returned && field_boxes_returned > 0) {
      // Find or create field box material
      const fieldBoxMaterial = await sql`
        SELECT id FROM materials_inventory 
        WHERE material_name ILIKE '%caja%campo%' OR material_name ILIKE '%field box%'
        LIMIT 1
      `;

      if (fieldBoxMaterial.length > 0) {
        const boxId = fieldBoxMaterial[0].id;
        const currentBoxes = await sql`
          SELECT quantity_available FROM materials_inventory WHERE id = ${boxId}
        `;

        const newBoxQty = (currentBoxes[0]?.quantity_available || 0) + field_boxes_returned;
        
        await sql`
          UPDATE materials_inventory
          SET quantity_available = ${newBoxQty}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${boxId}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      batch: batch,
      message: 'Kit generado y materiales deducidos exitosamente'
    });
  } catch (error) {
    console.error('Error generating kit:', error);
    return NextResponse.json(
      { error: error.message || 'Error generating kit' },
      { status: 500 }
    );
  }
}
