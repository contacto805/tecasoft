import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, user_id, notification_type as tipo, title, body, data, sent_at, is_read, read_at
      FROM notification_log 
      ORDER BY sent_at DESC LIMIT 40
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const { id, status, title, body } = await request.json();
    if (id && status) {
      await sql`
        UPDATE notification_log 
        SET is_read = ${status === 'resuelto' || status === 'descartado'}, 
            read_at = NOW(),
            data = jsonb_set(COALESCE(data,'{}'::jsonb), '{status}', ${JSON.stringify(status)})
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true });
    }
    // Crear alerta nueva
    if (title || body) {
      await sql`
        INSERT INTO notification_log (user_id, notification_type, title, body, sent_at, is_read)
        VALUES ('ia-system', 'ia_alerta', ${title || 'Alerta IA'}, ${body || ''}, NOW(), false)
      `;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) });
  }
}
