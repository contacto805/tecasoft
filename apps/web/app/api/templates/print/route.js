import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      template_id,
      customer_id,
      lot_id,
      printer_id,
      label_data,
      quantity,
      printed_by
    } = body;

    const [printRecord] = await sql`
      INSERT INTO print_history (
        template_id,
        customer_id,
        lot_id,
        printer_id,
        label_data,
        quantity_printed,
        printed_by
      ) VALUES (
        ${template_id},
        ${customer_id || null},
        ${lot_id || null},
        ${printer_id || null},
        ${JSON.stringify(label_data || {})},
        ${quantity || 1},
        ${printed_by}
      )
      RETURNING *
    `;

    return NextResponse.json(printRecord);
  } catch (error) {
    console.error('Error recording print:', error);
    return NextResponse.json({ error: 'Error al registrar impresión' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const lotId = searchParams.get('lotId');
    const limit = searchParams.get('limit') || '50';

    let query = sql`
      SELECT 
        p.*,
        t.template_name,
        c.customer_name,
        pr.printer_name
      FROM print_history p
      LEFT JOIN label_template_master t ON p.template_id = t.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN printer_configurations pr ON p.printer_id = pr.id
      WHERE 1=1
    `;

    if (templateId) {
      query = sql`${query} AND p.template_id = ${parseInt(templateId)}`;
    }

    if (lotId) {
      query = sql`${query} AND p.lot_id = ${parseInt(lotId)}`;
    }

    const finalQuery = sql`${query} ORDER BY p.printed_at DESC LIMIT ${parseInt(limit)}`;
    const history = await finalQuery;

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching print history:', error);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
