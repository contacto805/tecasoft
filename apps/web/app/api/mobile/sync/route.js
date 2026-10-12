import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Unified Mobile Sync API
 * Single endpoint for comprehensive sync of all mobile data
 * Supports batching and delta sync
 */

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      syncTimestamp, // Previous sync time in milliseconds
      modules = ['expenses', 'fruit-input'] // Which modules to sync
    } = body;

    const response = {
      status: 'success',
      timestamp: Date.now(),
      data: {}
    };

    // Sync expenses
    if (modules.includes('expenses')) {
      const expenses = await sql`
        SELECT 
          id,
          product_name,
          cost_per_unit,
          quantity,
          total,
          department,
          notes,
          expense_date,
          photo_url,
          created_at,
          updated_at
        FROM expenses 
        ${syncTimestamp ? sql`WHERE updated_at > ${new Date(syncTimestamp).toISOString()}` : sql``}
        ORDER BY updated_at DESC
      `;

      response.data.expenses = {
        count: expenses.length,
        records: expenses
      };
    }

    // Sync fruit input (lots)
    if (modules.includes('fruit-input')) {
      const lots = await sql`
        SELECT 
          l.id,
          l.lot_number,
          l.producer,
          l.orchard_name,
          l.fruit_type,
          l.date,
          l.fruit_price,
          l.collector_name,
          l.commission_amount,
          l.payment_days,
          l.payment_scheduled_date,
          l.is_cut_fruit,
          l.status,
          l.created_at,
          l.updated_at,
          COALESCE(COUNT(w.id), 0) as weighing_count,
          COALESCE(SUM(w.net_weight), 0) as total_kg,
          COALESCE(SUM(w.boxes), 0) as total_boxes
        FROM lots l
        LEFT JOIN weighings w ON l.id = w.lot_id
        ${syncTimestamp ? sql`WHERE l.updated_at > ${new Date(syncTimestamp).toISOString()}` : sql``}
        GROUP BY l.id 
        ORDER BY l.updated_at DESC
      `;

      // Get all weighings for synced lots
      let weighings = [];
      if (lots.length > 0) {
        const lotIds = lots.map(l => l.id);
        weighings = await sql`
          SELECT 
            id,
            lot_id,
            boxes,
            gross_weight,
            with_pallet,
            net_weight,
            photo_url,
            timestamp,
            tare_weight,
            created_at,
            updated_at
          FROM weighings
          WHERE lot_id = ANY(${lotIds})
          ${syncTimestamp ? sql`AND updated_at > ${new Date(syncTimestamp).toISOString()}` : sql``}
          ORDER BY timestamp DESC
        `;
      }

      response.data.fruitInput = {
        lots: {
          count: lots.length,
          records: lots
        },
        weighings: {
          count: weighings.length,
          records: weighings
        }
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in unified sync:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error en sincronización: ' + error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mobile/sync/health
 * Check API connectivity and server time
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    if (searchParams.get('health') === 'true') {
      return NextResponse.json({
        status: 'healthy',
        message: 'Tecavo Mobile API is running',
        timestamp: Date.now(),
        endpoints: {
          expenses: '/api/mobile/expenses',
          fruitInput: '/api/mobile/fruit-input',
          sync: '/api/mobile/sync',
          upload: '/api/upload'
        }
      });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Use POST for sync or add ?health=true for health check'
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
}
