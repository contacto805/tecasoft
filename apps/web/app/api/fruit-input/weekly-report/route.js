import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const brokerId = searchParams.get('brokerId');
    const producer = searchParams.get('producer');
    const weekNumber = searchParams.get('weekNumber');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Se requieren las fechas de inicio y fin' },
        { status: 400 }
      );
    }

    // Build dynamic WHERE clauses
    let whereConditions = sql`WHERE l.date >= ${startDate} AND l.date <= ${endDate}`;
    
    if (producer && producer !== 'all') {
      whereConditions = sql`${whereConditions} AND l.producer = ${producer}`;
    }
    
    if (brokerId && brokerId !== 'all') {
      whereConditions = sql`${whereConditions} AND l.collector_name = ${brokerId}`;
    }

    // Get all lots within the date range with their weighings
    const lotsData = await sql`
      SELECT 
        l.id,
        l.lot_number,
        l.producer,
        l.orchard_name,
        l.collector_name,
        l.fruit_price,
        l.date,
        COALESCE(SUM(w.boxes), 0) as total_boxes,
        COALESCE(SUM(w.net_weight), 0) as total_kg,
        COALESCE(SUM(w.net_weight) * l.fruit_price, 0) as total_value
      FROM lots l
      LEFT JOIN weighings w ON l.id = w.lot_id
      ${whereConditions}
      GROUP BY l.id, l.lot_number, l.producer, l.orchard_name, l.collector_name, l.fruit_price, l.date
      ORDER BY l.date ASC, l.lot_number ASC
    `;

    // Calculate totals
    const totals = {
      totalLots: lotsData.length,
      totalBoxes: lotsData.reduce((sum, lot) => sum + parseFloat(lot.total_boxes || 0), 0),
      totalKg: lotsData.reduce((sum, lot) => sum + parseFloat(lot.total_kg || 0), 0),
      totalValue: lotsData.reduce((sum, lot) => sum + parseFloat(lot.total_value || 0), 0)
    };

    // Get unique producers and brokers for filters
    const producers = await sql`
      SELECT DISTINCT producer 
      FROM lots 
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY producer ASC
    `;

    const brokers = await sql`
      SELECT DISTINCT collector_name 
      FROM lots 
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY collector_name ASC
    `;

    return NextResponse.json({
      lots: lotsData,
      totals,
      filters: {
        producers: producers.map(p => p.producer),
        brokers: brokers.map(b => b.collector_name)
      }
    });
  } catch (error) {
    console.error('Error in GET /api/fruit-input/weekly-report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
