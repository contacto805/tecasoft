import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener dispositivos biométricos
export async function GET() {
  try {
    const devices = await sql`
      SELECT * FROM biometric_devices
      ORDER BY is_active DESC, device_name ASC
    `;
    return NextResponse.json(devices);
  } catch (error) {
    console.error('Error fetching biometric devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar nuevo dispositivo biométrico
export async function POST(request) {
  try {
    const { 
      deviceName, 
      deviceModel, 
      deviceSerial, 
      connectionType, 
      ipAddress, 
      port 
    } = await request.json();

    if (!deviceName || !connectionType) {
      return NextResponse.json(
        { error: 'Nombre del dispositivo y tipo de conexión son requeridos' },
        { status: 400 }
      );
    }

    const [device] = await sql`
      INSERT INTO biometric_devices (
        device_name,
        device_model,
        device_serial,
        connection_type,
        ip_address,
        port,
        is_active
      )
      VALUES (
        ${deviceName},
        ${deviceModel || null},
        ${deviceSerial || null},
        ${connectionType},
        ${ipAddress || null},
        ${port ? parseInt(port) : null},
        true
      )
      RETURNING *
    `;

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error('Error creating biometric device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar dispositivo biométrico
export async function PUT(request) {
  try {
    const { 
      id, 
      deviceName, 
      deviceModel, 
      deviceSerial, 
      connectionType, 
      ipAddress, 
      port,
      isActive,
      lastSync
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE biometric_devices
      SET device_name = ${deviceName},
          device_model = ${deviceModel || null},
          device_serial = ${deviceSerial || null},
          connection_type = ${connectionType},
          ip_address = ${ipAddress || null},
          port = ${port ? parseInt(port) : null},
          is_active = ${isActive !== undefined ? isActive : true},
          last_sync = ${lastSync || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating biometric device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar dispositivo biométrico
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await sql`DELETE FROM biometric_devices WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true, message: 'Dispositivo eliminado' });
  } catch (error) {
    console.error('Error deleting biometric device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
