import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { lot_id } = await request.json();

    if (!lot_id) {
      return NextResponse.json({ error: "lot_id es requerido" }, { status: 400 });
    }

    // Verify lot exists
    const lot = await sql`SELECT id FROM lots WHERE id = ${lot_id}`;
    if (!lot || lot.length === 0) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Check if link already exists
    const existing = await sql`SELECT * FROM public_lot_links WHERE lot_id = ${lot_id}`;
    if (existing && existing.length > 0) {
      return NextResponse.json(existing[0]);
    }

    // Generate unique public token
    const token = crypto.randomBytes(16).toString("hex");

    const result = await sql`
      INSERT INTO public_lot_links (lot_id, public_token)
      VALUES (${lot_id}, ${token})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating public lot link:", error);
    return NextResponse.json({ error: "Error al crear enlace público" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }

    // Get lot link
    const link = await sql`
      SELECT * FROM public_lot_links 
      WHERE public_token = ${token} AND is_active = true
    `;

    if (!link || link.length === 0) {
      return NextResponse.json({ error: "Enlace no encontrado o inactivo" }, { status: 404 });
    }

    // Get lot details
    const lot = await sql`
      SELECT 
        l.*,
        COALESCE(SUM(w.net_weight), 0) as total_kg,
        COALESCE(SUM(w.boxes), 0) as total_boxes,
        COALESCE(SUM(w.gross_weight), 0) as gross_weight
      FROM lots l
      LEFT JOIN weighings w ON l.id = w.lot_id
      WHERE l.id = ${link[0].lot_id}
      GROUP BY l.id
    `;

    if (!lot || lot.length === 0) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Get lotification details if available
    const lotif = await sql`
      SELECT * FROM lotification_records 
      WHERE lot_id = ${lot[0].id}
      LIMIT 1
    `;

    return NextResponse.json({
      lot: lot[0],
      lotification: lotif && lotif.length > 0 ? lotif[0] : null,
      token
    });
  } catch (error) {
    console.error("Error fetching public lot:", error);
    return NextResponse.json({ error: "Error al cargar lote" }, { status: 500 });
  }
}
