import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { lot_id, quantity = 1, unit_type = "boxes" } = await request.json();

    if (!lot_id) {
      return NextResponse.json({ error: "lot_id es requerido" }, { status: 400 });
    }

    // Verify lot exists
    const lot = await sql`SELECT id, lot_number FROM lots WHERE id = ${lot_id}`;
    if (!lot || lot.length === 0) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Generate unique barcode code
    const timestamp = Date.now();
    const randomCode = Math.random().toString(36).substring(2, 9).toUpperCase();
    const barcodeCode = `LOT-${lot[0].lot_number}-${randomCode}-${timestamp}`;

    // Insert barcode
    const result = await sql`
      INSERT INTO inventory_barcodes (lot_id, barcode_code, barcode_type, quantity, unit_type)
      VALUES (${lot_id}, ${barcodeCode}, 'inventory', ${quantity}, ${unit_type})
      RETURNING *
    `;

    return NextResponse.json({
      id: result[0].id,
      barcode_code: result[0].barcode_code,
      lot_number: lot[0].lot_number,
      quantity,
      unit_type,
      generated_date: result[0].generated_date
    });
  } catch (error) {
    console.error("Error generating barcode:", error);
    return NextResponse.json(
      { error: "Error al generar código de barras" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lot_id = searchParams.get("lot_id");

    let query;
    if (lot_id) {
      query = await sql`
        SELECT * FROM inventory_barcodes 
        WHERE lot_id = ${lot_id}
        ORDER BY created_at DESC
      `;
    } else {
      query = await sql`
        SELECT * FROM inventory_barcodes 
        ORDER BY created_at DESC 
        LIMIT 100
      `;
    }

    return NextResponse.json(query);
  } catch (error) {
    console.error("Error fetching barcodes:", error);
    return NextResponse.json(
      { error: "Error al cargar códigos de barras" },
      { status: 500 }
    );
  }
}
