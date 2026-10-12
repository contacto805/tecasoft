import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const printers = await sql`
      SELECT * FROM printer_configurations
      WHERE is_active = true
      ORDER BY printer_name
    `;

    return NextResponse.json(printers);
  } catch (error) {
    console.error('Error fetching printers:', error);
    return NextResponse.json({ error: 'Error al obtener impresoras' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      printer_name,
      printer_type,
      connection_type,
      ip_address,
      port,
      device_path,
      paper_width_mm,
      area_assigned,
      is_default
    } = body;

    const [newPrinter] = await sql`
      INSERT INTO printer_configurations (
        printer_name,
        printer_type,
        connection_type,
        ip_address,
        port,
        device_path,
        paper_width_mm,
        area_assigned,
        is_default
      ) VALUES (
        ${printer_name},
        ${printer_type},
        ${connection_type},
        ${ip_address || null},
        ${port || null},
        ${device_path || null},
        ${paper_width_mm},
        ${area_assigned},
        ${is_default || false}
      )
      RETURNING *
    `;

    return NextResponse.json(newPrinter);
  } catch (error) {
    console.error('Error creating printer:', error);
    return NextResponse.json({ error: 'Error al crear impresora' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      printer_name,
      printer_type,
      connection_type,
      ip_address,
      port,
      device_path,
      paper_width_mm,
      area_assigned,
      is_default,
      is_active
    } = body;

    const [updated] = await sql`
      UPDATE printer_configurations
      SET
        printer_name = ${printer_name},
        printer_type = ${printer_type},
        connection_type = ${connection_type},
        ip_address = ${ip_address || null},
        port = ${port || null},
        device_path = ${device_path || null},
        paper_width_mm = ${paper_width_mm},
        area_assigned = ${area_assigned},
        is_default = ${is_default || false},
        is_active = ${is_active !== undefined ? is_active : true},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating printer:', error);
    return NextResponse.json({ error: 'Error al actualizar impresora' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`
      UPDATE printer_configurations
      SET is_active = false
      WHERE id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting printer:', error);
    return NextResponse.json({ error: 'Error al eliminar impresora' }, { status: 500 });
  }
}
