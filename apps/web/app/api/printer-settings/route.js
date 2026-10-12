import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const printers = await sql`
      SELECT * FROM printer_settings 
      ORDER BY is_default DESC, created_at DESC
    `;
    return NextResponse.json(printers);
  } catch (error) {
    console.error("Error fetching printers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      printer_name,
      printer_type,
      connection_type,
      ip_address,
      port,
      device_path,
      paper_width_mm,
      is_default,
      is_active
    } = data;

    // If setting as default, unset all others
    if (is_default) {
      await sql`UPDATE printer_settings SET is_default = false`;
    }

    const result = await sql`
      INSERT INTO printer_settings (
        printer_name, printer_type, connection_type, ip_address, 
        port, device_path, paper_width_mm, is_default, is_active
      ) VALUES (
        ${printer_name}, ${printer_type}, ${connection_type}, ${ip_address},
        ${port || null}, ${device_path || null}, ${paper_width_mm}, 
        ${is_default || false}, ${is_active !== false}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating printer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const {
      id,
      printer_name,
      printer_type,
      connection_type,
      ip_address,
      port,
      device_path,
      paper_width_mm,
      is_default,
      is_active
    } = data;

    // If setting as default, unset all others
    if (is_default) {
      await sql`UPDATE printer_settings SET is_default = false`;
    }

    const result = await sql`
      UPDATE printer_settings 
      SET 
        printer_name = ${printer_name},
        printer_type = ${printer_type},
        connection_type = ${connection_type},
        ip_address = ${ip_address},
        port = ${port || null},
        device_path = ${device_path || null},
        paper_width_mm = ${paper_width_mm},
        is_default = ${is_default || false},
        is_active = ${is_active !== false},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating printer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    await sql`DELETE FROM printer_settings WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting printer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
