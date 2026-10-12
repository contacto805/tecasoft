import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const userId = searchParams.get('userId');

  let query;
  
  if (userId) {
    query = sql`
      SELECT 
        pc.*,
        u1.name as requested_by_name,
        u2.name as reviewed_by_name
      FROM pending_changes pc
      LEFT JOIN "user" u1 ON pc.requested_by = u1.id
      LEFT JOIN "user" u2 ON pc.reviewed_by = u2.id
      WHERE pc.status = ${status}
      ORDER BY pc.requested_at DESC
    `;
  } else {
    query = sql`
      SELECT 
        pc.*,
        u1.name as requested_by_name,
        u2.name as reviewed_by_name
      FROM pending_changes pc
      LEFT JOIN "user" u1 ON pc.requested_by = u1.id
      LEFT JOIN "user" u2 ON pc.reviewed_by = u2.id
      WHERE pc.status = ${status}
      ORDER BY pc.requested_at DESC
    `;
  }

  const changes = await query;
  return NextResponse.json(changes);
}

export async function POST(request) {
  try {
    const {
      changeType,
      module,
      tableName,
      recordId,
      originalData,
      newData,
      requestedBy
    } = await request.json();

    const result = await sql`
      INSERT INTO pending_changes (
        change_type,
        module,
        table_name,
        record_id,
        original_data,
        new_data,
        requested_by
      ) VALUES (
        ${changeType},
        ${module},
        ${tableName},
        ${recordId || null},
        ${originalData ? JSON.stringify(originalData) : null},
        ${JSON.stringify(newData)},
        ${requestedBy}
      )
      RETURNING *
    `;

    // Send notification to super admin
    await sendNotificationToSuperAdmin({
      type: changeType,
      module,
      changeId: result[0].id
    });

    return NextResponse.json({
      success: true,
      change: result[0]
    });
  } catch (error) {
    console.error('Error creating pending change:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, status, reviewedBy, reviewNotes } = await request.json();

    // Get the pending change
    const [change] = await sql`
      SELECT * FROM pending_changes WHERE id = ${parseInt(id)}
    `;

    if (!change) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cambio no encontrado' 
      }, { status: 404 });
    }

    // Update the pending change status
    await sql`
      UPDATE pending_changes
      SET 
        status = ${status},
        reviewed_by = ${reviewedBy},
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = ${reviewNotes || null}
      WHERE id = ${parseInt(id)}
    `;

    // If approved, apply the change
    if (status === 'approved') {
      await applyChange(change);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pending change:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function applyChange(change) {
  const { change_type, table_name, record_id, new_data } = change;

  if (change_type === 'create') {
    // Insert new record
    const columns = Object.keys(new_data);
    const values = Object.values(new_data);
    
    const columnNames = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    await sql.unsafe(`INSERT INTO ${table_name} (${columnNames}) VALUES (${placeholders})`, values);
  } else if (change_type === 'update') {
    // Update existing record
    const updates = Object.entries(new_data)
      .map(([key], i) => `${key} = $${i + 1}`)
      .join(', ');
    const values = [...Object.values(new_data), record_id];
    
    await sql.unsafe(`UPDATE ${table_name} SET ${updates} WHERE id = $${values.length}`, values);
  } else if (change_type === 'delete') {
    // Delete record
    await sql.unsafe(`DELETE FROM ${table_name} WHERE id = $1`, [record_id]);
  }
}

async function sendNotificationToSuperAdmin({ type, module, changeId }) {
  try {
    // Get super admin user
    const superAdmins = await sql`
      SELECT id FROM "user" WHERE is_super_admin = true
    `;

    if (superAdmins.length === 0) return;

    const title = `Nuevo cambio pendiente: ${module}`;
    const body = `Se ha solicitado un ${type} en ${module}`;

    // Log notification
    for (const admin of superAdmins) {
      await sql`
        INSERT INTO notification_log (
          user_id,
          notification_type,
          title,
          body,
          data
        ) VALUES (
          ${admin.id},
          'pending_change',
          ${title},
          ${body},
          ${JSON.stringify({ changeId, module, type })}
        )
      `;
    }

    // Send push notification (to be implemented with Expo)
    await sendPushNotification(superAdmins.map(a => a.id), {
      title,
      body,
      data: { changeId, module, type }
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

async function sendPushNotification(userIds, notification) {
  try {
    // Get push tokens for users
    const tokens = await sql`
      SELECT push_token 
      FROM push_notifications 
      WHERE user_id = ANY(${userIds}) 
      AND is_active = true
    `;

    if (tokens.length === 0) return;

    // Send push notifications using Expo Push API
    const messages = tokens.map(({ push_token }) => ({
      to: push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: 'high'
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages)
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
