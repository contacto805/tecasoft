import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId, pushToken, deviceType } = await request.json();

    // Check if token already exists
    const existing = await sql`
      SELECT id FROM push_notifications 
      WHERE user_id = ${userId} AND push_token = ${pushToken}
    `;

    if (existing.length > 0) {
      // Update existing token
      await sql`
        UPDATE push_notifications
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `;
    } else {
      // Insert new token
      await sql`
        INSERT INTO push_notifications (user_id, push_token, device_type)
        VALUES (${userId}, ${pushToken}, ${deviceType})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push token:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const pushToken = searchParams.get('pushToken');

    await sql`
      UPDATE push_notifications
      SET is_active = false
      WHERE user_id = ${userId} AND push_token = ${pushToken}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing push token:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
