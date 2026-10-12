import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get the last sales folio with pattern VENTA-XXXX
    const result = await sql`
      SELECT sales_folio 
      FROM sales_of_process_and_waste 
      WHERE sales_folio LIKE 'VENTA-%'
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ nextFolio: "VENTA-0001" });
    }

    const lastFolio = result[0].sales_folio;
    const numberPart = parseInt(lastFolio.split("-")[1]);
    const nextFolio = `VENTA-${String(numberPart + 1).padStart(4, "0")}`;

    return NextResponse.json({ nextFolio });
  } catch (error) {
    console.error("Error getting next sales folio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
