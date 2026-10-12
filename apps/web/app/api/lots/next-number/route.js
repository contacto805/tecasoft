import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get the highest lot number with TCV-FTS prefix
    const result = await sql`
      SELECT lot_number 
      FROM lots 
      WHERE lot_number LIKE 'TCV-FTS-%'
      ORDER BY lot_number DESC 
      LIMIT 1
    `;

    let nextNumber = 1;

    if (result.length > 0) {
      // Extract the numeric part from the last lot number
      const lastLotNumber = result[0].lot_number;
      const match = lastLotNumber.match(/TCV-FTS-(\d+)/);
      
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        nextNumber = lastNumber + 1;
      }
    }

    // Format with leading zeros (4 digits)
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    const lotNumber = `TCV-FTS-${formattedNumber}`;

    return NextResponse.json({ lotNumber });
  } catch (error) {
    console.error('Error generating next lot number:', error);
    return NextResponse.json(
      { error: 'Error al generar el número de lote' },
      { status: 500 }
    );
  }
}
