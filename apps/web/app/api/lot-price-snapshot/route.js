import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener snapshots de precios de lotes
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const weekHistoryId = searchParams.get('weekHistoryId');

    if (lotId) {
      const [snapshot] = await sql`
        SELECT lps.*, l.lot_number, l.producer, l.date as lot_date
        FROM lot_price_snapshot lps
        LEFT JOIN lots l ON l.id = lps.lot_id
        WHERE lps.lot_id = ${parseInt(lotId)}
      `;
      return NextResponse.json(snapshot || null);
    }

    if (weekHistoryId) {
      const snapshots = await sql`
        SELECT lps.*, l.lot_number, l.producer, l.date as lot_date
        FROM lot_price_snapshot lps
        LEFT JOIN lots l ON l.id = lps.lot_id
        WHERE lps.week_history_id = ${parseInt(weekHistoryId)}
        ORDER BY l.date DESC
      `;
      return NextResponse.json(snapshots);
    }

    const snapshots = await sql`
      SELECT lps.*, l.lot_number, l.producer, l.date as lot_date
      FROM lot_price_snapshot lps
      LEFT JOIN lots l ON l.id = lps.lot_id
      ORDER BY lps.created_at DESC
      LIMIT 100
    `;
    
    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('Error fetching lot price snapshots:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear snapshot de precio para lote
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lotId,
      weekHistoryId,
      priceGramajeId,
      priceBandaId,
      priceApplied,
      priceType,
      category,
      gramaje,
      kgReceived,
      totalCost
    } = body;

    if (!lotId || !priceApplied) {
      return NextResponse.json(
        { error: 'Lote y precio son requeridos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO lot_price_snapshot (
        lot_id, week_history_id, price_gramaje_id, price_banda_id,
        price_applied, price_type, category, gramaje, kg_received, total_cost
      ) VALUES (
        ${lotId}, ${weekHistoryId || null}, ${priceGramajeId || null},
        ${priceBandaId || null}, ${priceApplied}, ${priceType || null},
        ${category || null}, ${gramaje || null}, ${kgReceived || null},
        ${totalCost || null}
      ) RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating lot price snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
