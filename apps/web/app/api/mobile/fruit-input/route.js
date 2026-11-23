import { newLotToken } from "@/app/api/utils/lot-portal";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Mobile Fruit Input Sync API
 * Endpoints for mobile apps to sync fruit input (weighings and lot data)
 * 
 * GET /api/mobile/fruit-input - Get all fruit input records
 * POST /api/mobile/fruit-input - Create new fruit input/weighing
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const syncTimestamp = searchParams.get('syncTimestamp'); // For delta sync

    let lotsQuery = `
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
      WHERE 1=1
    `;

    const conditions = [];

    if (lotId) {
      conditions.push(`l.id = ${lotId}`);
    }

    if (syncTimestamp) {
      conditions.push(`l.updated_at > '${new Date(parseInt(syncTimestamp)).toISOString()}'`);
    }

    if (conditions.length > 0) {
      lotsQuery += ' AND ' + conditions.join(' AND ');
    }

    lotsQuery += ' GROUP BY l.id ORDER BY l.created_at DESC';

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
      ${lotId ? sql`WHERE l.id = ${parseInt(lotId)}` : sql``}
      ${syncTimestamp ? sql`WHERE l.updated_at > ${new Date(parseInt(syncTimestamp)).toISOString()}` : sql``}
      GROUP BY l.id 
      ORDER BY l.created_at DESC
    `;

    // If requesting specific lot, also get its weighings
    let weighings = [];
    if (lotId) {
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
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY timestamp DESC
      `;
    }

    return NextResponse.json({
      status: 'success',
      timestamp: Date.now(),
      data: {
        lots,
        weighings
      },
      count: lots.length
    });
  } catch (error) {
    console.error('Error fetching fruit input for mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al obtener entrada de fruta: ' + error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actionType } = body;

    // Create new lot
    if (actionType === 'createLot') {
      const {
        lot_number,
        producer,
        orchard_name,
        fruit_type,
        date,
        fruit_price,
        collector_name,
        commission_amount,
        payment_days,
        is_cut_fruit
      } = body;

      if (!lot_number || !producer || !fruit_type || !fruit_price || !collector_name) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Campos requeridos: lot_number, producer, fruit_type, fruit_price, collector_name'
          },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existingLot = await sql`
        SELECT id FROM lots WHERE lot_number = ${lot_number}
      `;

      if (existingLot.length > 0) {
        return NextResponse.json(
          {
            status: 'error',
            message: `El número de lote "${lot_number}" ya existe`
          },
          { status: 409 }
        );
      }

      const result = await sql`
        WITH new_lot AS (
        INSERT INTO lots (
          lot_number, producer, orchard_name, fruit_type, date, fruit_price, 
          collector_name, commission_amount, payment_days, is_cut_fruit, status, created_at, updated_at
        )
        VALUES (
          ${lot_number}, ${producer}, ${orchard_name || ''}, ${fruit_type}, 
          ${date || new Date().toISOString().split('T')[0]}, ${parseFloat(fruit_price)},
          ${collector_name}, ${commission_amount ? parseFloat(commission_amount) : 0}, 
          ${payment_days || 0}, ${is_cut_fruit || false}, 'selection', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id, lot_number, producer, orchard_name, fruit_type, date, fruit_price, 
                  collector_name, commission_amount, is_cut_fruit, status, created_at, updated_at
        ), new_link AS (
          INSERT INTO public_lot_links (lot_id, public_token, is_active, created_at, updated_at)
          SELECT id, ${newLotToken()}, true, NOW(), NOW() FROM new_lot
          RETURNING lot_id
        )
        SELECT new_lot.* FROM new_lot JOIN new_link ON new_link.lot_id = new_lot.id
      `;

      return NextResponse.json(
        {
          status: 'success',
          message: 'Lote creado exitosamente',
          data: result[0]
        },
        { status: 201 }
      );
    }

    // Create weighing for lot
    if (actionType === 'createWeighing') {
      const {
        lot_id,
        boxes,
        gross_weight,
        with_pallet,
        net_weight,
        photo_url,
        tare_weight
      } = body;

      if (!lot_id || boxes === undefined || !gross_weight || net_weight === undefined) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Campos requeridos: lot_id, boxes, gross_weight, net_weight'
          },
          { status: 400 }
        );
      }

      const result = await sql`
        INSERT INTO weighings (
          lot_id, boxes, gross_weight, with_pallet, net_weight, photo_url, tare_weight, timestamp, created_at, updated_at
        )
        VALUES (
          ${parseInt(lot_id)}, ${parseInt(boxes)}, ${parseFloat(gross_weight)}, ${with_pallet || false},
          ${parseFloat(net_weight)}, ${photo_url || null}, ${tare_weight ? parseFloat(tare_weight) : null},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id, lot_id, boxes, gross_weight, with_pallet, net_weight, photo_url, timestamp, tare_weight, created_at, updated_at
      `;

      return NextResponse.json(
        {
          status: 'success',
          message: 'Pesaje registrado exitosamente',
          data: result[0]
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        message: 'actionType no especificado o inválido. Use: createLot o createWeighing'
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating fruit input from mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al registrar entrada de fruta: ' + error.message
      },
      { status: 500 }
    );
  }
}
