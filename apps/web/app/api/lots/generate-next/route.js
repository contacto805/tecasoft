import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Genera el siguiente número de lote en formato TCV-FTS-YYNNNN
 * Ejemplo: TCV-FTS-260001, TCV-FTS-260002, etc.
 * Donde YY = últimos 2 dígitos del año, NNNN = número secuencial de 4 dígitos
 */
export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2); // Últimos 2 dígitos del año
    
    // Buscar el último lote del año actual
    const yearPrefix = `TCV-FTS-${yearSuffix}`;
    
    const result = await sql`
      SELECT lot_number 
      FROM lots 
      WHERE lot_number LIKE ${yearPrefix + '%'}
      ORDER BY lot_number DESC 
      LIMIT 1
    `;

    let nextNumber = 1;

    if (result.length > 0) {
      // Extraer la parte numérica del último lote
      const lastLotNumber = result[0].lot_number;
      const pattern = new RegExp(`TCV-FTS-${yearSuffix}(\\d{4})`);
      const match = lastLotNumber.match(pattern);
      
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        nextNumber = lastNumber + 1;
      }
    }

    // Formatear con ceros a la izquierda (4 dígitos)
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    const lotNumber = `TCV-FTS-${yearSuffix}${formattedNumber}`;

    return NextResponse.json({ lotNumber, year: currentYear, sequenceNumber: nextNumber });
  } catch (error) {
    console.error('Error generating next lot number:', error);
    return NextResponse.json(
      { error: 'Error al generar el número de lote' },
      { status: 500 }
    );
  }
}
