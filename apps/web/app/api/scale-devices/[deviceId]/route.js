import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  try {
    const { deviceId } = await params;
    const { isEnabled, lastConnected } = await request.json();

    const result = await sql`
      UPDATE scale_devices 
      SET 
        is_enabled = ${isEnabled !== undefined ? isEnabled : null},
        last_connected = ${lastConnected || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(deviceId)}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating scale device:', error);
    return NextResponse.json(
      { error: 'Error updating scale device' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { deviceId } = await params;

    const result = await sql`
      DELETE FROM scale_devices 
      WHERE id = ${parseInt(deviceId)}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scale device:', error);
    return NextResponse.json(
      { error: 'Error deleting scale device' },
      { status: 500 }
    );
  }
}
