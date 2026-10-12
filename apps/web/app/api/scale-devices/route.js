import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get scale devices for a specific user
      const devices = await sql`
        SELECT * FROM scale_devices 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return NextResponse.json(devices);
    }

    // Get all active scale devices
    const devices = await sql`
      SELECT * FROM scale_devices 
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    return NextResponse.json(devices);
  } catch (error) {
    console.error('Error in GET /api/scale-devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { 
      userId,
      device_name,
      model_type,
      port,
      baud_rate = 9600,
      connection_type = 'USB'
    } = await request.json();

    if (!userId || !device_name) {
      return NextResponse.json(
        { error: 'userId y device_name son requeridos' }, 
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO scale_devices (
        user_id,
        device_name,
        model_type,
        port,
        baud_rate,
        connection_type,
        is_active,
        is_enabled
      ) VALUES (
        ${userId},
        ${device_name},
        ${model_type || null},
        ${port || null},
        ${baud_rate},
        ${connection_type},
        true,
        false
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/scale-devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { 
      id,
      device_name,
      model_type,
      port,
      baud_rate,
      is_enabled,
      connection_type
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' }, 
        { status: 400 }
      );
    }

    // Build dynamic update query
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (device_name !== undefined) {
      updateFields.push(`device_name = $${paramCount}`);
      values.push(device_name);
      paramCount++;
    }
    if (model_type !== undefined) {
      updateFields.push(`model_type = $${paramCount}`);
      values.push(model_type);
      paramCount++;
    }
    if (port !== undefined) {
      updateFields.push(`port = $${paramCount}`);
      values.push(port);
      paramCount++;
    }
    if (baud_rate !== undefined) {
      updateFields.push(`baud_rate = $${paramCount}`);
      values.push(baud_rate);
      paramCount++;
    }
    if (is_enabled !== undefined) {
      updateFields.push(`is_enabled = $${paramCount}`);
      values.push(is_enabled);
      paramCount++;
    }
    if (connection_type !== undefined) {
      updateFields.push(`connection_type = $${paramCount}`);
      values.push(connection_type);
      paramCount++;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    // If enabling this device, disable others for the same user
    if (is_enabled === true) {
      const device = await sql`SELECT user_id FROM scale_devices WHERE id = ${id}`;
      if (device.length > 0) {
        await sql`UPDATE scale_devices SET is_enabled = false WHERE user_id = ${device[0].user_id} AND id != ${id}`;
      }
    }

    const result = await sql`
      UPDATE scale_devices
      SET ${sql([updateFields.join(', ')])}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Dispositivo no encontrado' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error in PUT /api/scale-devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' }, 
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM scale_devices WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Dispositivo no encontrado' }, 
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: result[0] });
  } catch (error) {
    console.error('Error in DELETE /api/scale-devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
