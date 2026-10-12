import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    let query;
    
    if (unreadOnly) {
      query = sql`
        SELECT * FROM notification_log
        WHERE user_id = ${userId} AND is_read = false
        ORDER BY sent_at DESC
        LIMIT 50
      `;
    } else {
      query = sql`
        SELECT * FROM notification_log
        WHERE user_id = ${userId}
        ORDER BY sent_at DESC
        LIMIT 100
      `;
    }

    const notifications = await query;
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, isRead } = await request.json();

    await sql`
      UPDATE notification_log
      SET 
        is_read = ${isRead},
        read_at = ${isRead ? sql`CURRENT_TIMESTAMP` : null}
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, title, body, type, data } = await request.json();

    await sql`
      INSERT INTO notification_log (
        user_id,
        notification_type,
        title,
        body,
        data
      ) VALUES (
        ${userId},
        ${type},
        ${title},
        ${body},
        ${data ? JSON.stringify(data) : null}
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
