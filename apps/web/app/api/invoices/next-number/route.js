import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await sql`
      SELECT invoice_number 
      FROM invoices 
      WHERE invoice_number LIKE 'FAC-%'
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ nextNumber: "FAC-001" });
    }

    const lastNumber = result[0].invoice_number;
    const numberPart = parseInt(lastNumber.split("-")[1]);
    const nextNumber = `FAC-${String(numberPart + 1).padStart(3, "0")}`;

    return NextResponse.json({ nextNumber });
  } catch (error) {
    console.error("Error getting next invoice number:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
