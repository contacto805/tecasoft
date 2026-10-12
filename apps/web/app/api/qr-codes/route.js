import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { type, lot_id, material_id, quantity = 1, description, lot_number } = await request.json();

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    // Improved: stable persistent code tied to entity (not pure random)
    let qrCode;
    if (type.toLowerCase() === 'lot' && (lot_id || lot_number)) {
      qrCode = `LOT-${lot_number || lot_id}`;
    } else if (type.toLowerCase() === 'tarima' || type.toLowerCase() === 'pallet') {
      qrCode = `TAR-${lot_id || ''}-${Date.now().toString().slice(-6)}`;
    } else {
      const ts = Date.now();
      const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
      qrCode = `${type.toUpperCase()}-${lot_id || ''}-${ts}-${rnd}`;
    }

    const result = await sql`
      INSERT INTO qr_codes (code, type, lot_id, material_id, quantity, description)
      VALUES (${qrCode}, ${type}, ${lot_id || null}, ${material_id || null}, ${quantity}, ${description || null})
      RETURNING *
    `;

    return NextResponse.json({
      id: result[0].id,
      code: result[0].code,
      type: result[0].type,
      lot_id: result[0].lot_id,
      material_id: result[0].material_id,
      quantity: result[0].quantity,
      created_at: result[0].created_at
    });
  } catch (error) {
    console.error("Error creating QR code:", error);
    return NextResponse.json({ error: "Error creating QR code" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const lot_id = searchParams.get("lot_id");

    let query;
    if (type && lot_id) {
      query = await sql`
        SELECT * FROM qr_codes 
        WHERE type = ${type} AND lot_id = ${parseInt(lot_id)}
        ORDER BY created_at DESC
      `;
    } else if (type) {
      query = await sql`
        SELECT * FROM qr_codes 
        WHERE type = ${type}
        ORDER BY created_at DESC
      `;
    } else {
      query = await sql`
        SELECT * FROM qr_codes 
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return NextResponse.json(query);
  } catch (error) {
    console.error("Error fetching QR codes:", error);
    return NextResponse.json(
      { error: "Error fetching QR codes" },
      { status: 500 }
    );
  }
}
