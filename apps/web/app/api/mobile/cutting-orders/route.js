import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Mobile Cutting Orders Sync API
 * Used by the cutting-orders-mobile Expo app for real-time sync 
 * with the web system (module /cutting-orders)
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const syncTimestamp = searchParams.get('syncTimestamp');

    let queryFilter = '';
    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      queryFilter = `WHERE status = '${status}'`;
    } else {
      queryFilter = '';
    }

    const orders = await sql`
      SELECT 
        id,
        folio,
        cutting_date,
        producer_name,
        orchard_name,
        location,
        scale,
        meeting_point,
        truck_plates,
        truck_type,
        driver_name,
        crew_chief_name,
        crew_chief_phone,
        driver_phone,
        boxes_count,
        status,
        notes,
        lot_id,
        created_at,
        updated_at
      FROM cutting_orders 
      ${status ? sql`WHERE status = ${status}` : sql``}
      ${syncTimestamp ? (status ? sql`AND updated_at > ${new Date(parseInt(syncTimestamp)).toISOString()}` : sql`WHERE updated_at > ${new Date(parseInt(syncTimestamp)).toISOString()}`) : sql``}
      ORDER BY created_at DESC 
      LIMIT 200
    `;

    return NextResponse.json({
      status: 'success',
      timestamp: Date.now(),
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching cutting orders for mobile:', error);
    return NextResponse.json(
      { status: 'error', message: 'Error obteniendo órdenes: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      producer_name,
      orchard_name,
      cutting_date,
      location,
      boxes_count,
      crew_chief_name,
      driver_name,
      meeting_point,
      truck_plates,
      scale,
      crew_workers_count,
      notes,
      photo_url
    } = body;

    if (!producer_name || !boxes_count) {
      return NextResponse.json(
        { status: 'error', message: 'Productor y cantidad de cajas son requeridos' },
        { status: 400 }
      );
    }

    // Generate folio
    const folio = `COR-${Date.now().toString().slice(-8)}`;

    const result = await sql`
      INSERT INTO cutting_orders (
        folio,
        cutting_date,
        producer_name,
        orchard_name,
        location,
        scale,
        meeting_point,
        truck_plates,
        truck_type,
        driver_name,
        crew_chief_name,
        crew_workers_count,
        boxes_count,
        status,
        notes,
        created_at,
        updated_at
      ) VALUES (
        ${folio},
        ${cutting_date || new Date().toISOString().split('T')[0]},
        ${producer_name},
        ${orchard_name || ''},
        ${location || ''},
        ${scale || ''},
        ${meeting_point || ''},
        ${truck_plates || ''},
        'pickup',
        ${driver_name || ''},
        ${crew_chief_name || ''},
        ${parseInt(crew_workers_count || 0)},
        ${parseInt(boxes_count)},
        'pending',
        ${(notes || '') + (photo_url ? ` | Foto: ${photo_url}` : '') },
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    return NextResponse.json({
      status: 'success',
      message: 'Orden de corte creada exitosamente',
      data: result[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating cutting order from mobile:', error);
    return NextResponse.json(
      { status: 'error', message: 'Error creando orden: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, status, notes, ...rest } = await request.json();

    if (!id) {
      return NextResponse.json({ status: 'error', message: 'ID requerido' }, { status: 400 });
    }

    const allowed = ['pending', 'in_progress', 'completed'];
    const newStatus = allowed.includes(status) ? status : null;

    const [updated] = await sql`
      UPDATE cutting_orders
      SET 
        ${newStatus ? sql`status = ${newStatus},` : sql``}
        notes = ${notes || ''},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!updated) {
      return NextResponse.json({ status: 'error', message: 'Orden no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'success',
      data: updated
    });
  } catch (error) {
    console.error('Error updating cutting order mobile:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
