import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener logs de acceso
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    let where = sql``;
    if (userId) {
      where = sql`WHERE user_id = ${userId}`;
    }

    const accessLogs = await sql`
      SELECT * FROM user_access_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(accessLogs);
  } catch (error) {
    console.error('Error fetching access logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar acceso de usuario
export async function POST(request) {
  try {
    const { user_id, user_name, action, module, ip_address, user_agent, session_id } = await request.json();

    const [log] = await sql`
      INSERT INTO user_access_log (user_id, user_name, action, module, ip_address, user_agent, session_id)
      VALUES (${user_id}, ${user_name}, ${action}, ${module}, ${ip_address}, ${user_agent}, ${session_id})
      RETURNING *
    `;

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error logging access:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
