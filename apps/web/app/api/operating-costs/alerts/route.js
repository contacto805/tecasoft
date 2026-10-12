import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get('isRead');
    const severity = searchParams.get('severity');

    let where = sql`WHERE 1=1`;

    if (isRead !== null && isRead !== undefined) {
      where = sql`${where} AND is_read = ${isRead === 'true'}`;
    }
    if (severity) {
      where = sql`${where} AND severity = ${severity}`;
    }

    const alerts = await sql`
      SELECT ca.*,
        oc.folio,
        oc.cost_concept,
        l.lot_number
      FROM cost_alerts ca
      LEFT JOIN operating_costs oc ON ca.cost_id = oc.id
      LEFT JOIN lots l ON ca.lot_id = l.id
      ${where}
      ORDER BY ca.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching cost alerts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, is_read, read_by } = await request.json();

    await sql`
      UPDATE cost_alerts
      SET is_read = ${is_read},
          read_by = ${read_by},
          read_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
