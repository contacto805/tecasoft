import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get the latest thermal label number
    const result = await sql`
      SELECT 
        COALESCE(MAX(CAST(SUBSTRING(lot_number FROM '^TL-(\d+)$') AS INTEGER)), 0) as max_number
      FROM thermal_labels
      WHERE lot_number LIKE 'TL-%'
    `;

    const maxNumber = result[0]?.max_number || 0;
    const nextNumber = maxNumber + 1;
    const nextLotNumber = `TL-${String(nextNumber).padStart(6, '0')}`;

    // Validate uniqueness
    const existingLot = await sql`
      SELECT id FROM thermal_labels WHERE lot_number = ${nextLotNumber}
    `;

    if (existingLot.length > 0) {
      // In case of collision, increment again
      const nextLotNumberRetry = `TL-${String(nextNumber + 1).padStart(6, '0')}`;
      return NextResponse.json({
        success: true,
        nextLotNumber: nextLotNumberRetry,
        sequence: nextNumber + 1
      });
    }

    return NextResponse.json({
      success: true,
      nextLotNumber: nextLotNumber,
      sequence: nextNumber
    });
  } catch (error) {
    console.error('Error generating next thermal label number:', error);
    return NextResponse.json(
      { error: 'Error generating thermal label number' },
      { status: 500 }
    );
  }
}
