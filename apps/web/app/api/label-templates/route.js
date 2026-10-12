import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get("customer_id");

    let templates;
    if (customer_id) {
      templates = await sql`
        SELECT * FROM label_templates 
        WHERE customer_id = ${customer_id} OR customer_id IS NULL
        ORDER BY is_default DESC, created_at DESC
      `;
    } else {
      templates = await sql`
        SELECT * FROM label_templates 
        ORDER BY is_default DESC, created_at DESC
      `;
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching label templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      customer_id,
      template_name,
      label_width_mm,
      label_height_mm,
      show_logo,
      show_company_name,
      show_customer_name,
      show_lot_number,
      show_producer,
      show_orchard,
      show_caliber,
      show_class,
      show_weight,
      show_boxes,
      show_packing_date,
      show_barcode,
      show_qr,
      logo_size,
      font_size_title,
      font_size_body,
      font_size_small,
      background_color,
      text_color,
      border_color,
      header_text,
      footer_text,
      custom_fields,
      is_default
    } = data;

    // If setting as default, unset all others for this customer
    if (is_default) {
      if (customer_id) {
        await sql`UPDATE label_templates SET is_default = false WHERE customer_id = ${customer_id}`;
      } else {
        await sql`UPDATE label_templates SET is_default = false WHERE customer_id IS NULL`;
      }
    }

    const result = await sql`
      INSERT INTO label_templates (
        customer_id, template_name, label_width_mm, label_height_mm,
        show_logo, show_company_name, show_customer_name, show_lot_number,
        show_producer, show_orchard, show_caliber, show_class, show_weight,
        show_boxes, show_packing_date, show_barcode, show_qr,
        logo_size, font_size_title, font_size_body, font_size_small,
        background_color, text_color, border_color,
        header_text, footer_text, custom_fields, is_default
      ) VALUES (
        ${customer_id || null}, ${template_name}, ${label_width_mm}, ${label_height_mm},
        ${show_logo !== false}, ${show_company_name !== false}, ${show_customer_name !== false}, 
        ${show_lot_number !== false}, ${show_producer !== false}, ${show_orchard !== false}, 
        ${show_caliber !== false}, ${show_class !== false}, ${show_weight !== false},
        ${show_boxes !== false}, ${show_packing_date !== false}, ${show_barcode !== false}, 
        ${show_qr !== false}, ${logo_size || 40}, ${font_size_title || 16}, 
        ${font_size_body || 12}, ${font_size_small || 8},
        ${background_color || '#FFFFFF'}, ${text_color || '#000000'}, 
        ${border_color || '#000000'}, ${header_text || ''}, ${footer_text || ''},
        ${JSON.stringify(custom_fields || {})}, ${is_default || false}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating label template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const {
      id,
      customer_id,
      template_name,
      label_width_mm,
      label_height_mm,
      show_logo,
      show_company_name,
      show_customer_name,
      show_lot_number,
      show_producer,
      show_orchard,
      show_caliber,
      show_class,
      show_weight,
      show_boxes,
      show_packing_date,
      show_barcode,
      show_qr,
      logo_size,
      font_size_title,
      font_size_body,
      font_size_small,
      background_color,
      text_color,
      border_color,
      header_text,
      footer_text,
      custom_fields,
      is_default
    } = data;

    // If setting as default, unset all others for this customer
    if (is_default) {
      if (customer_id) {
        await sql`UPDATE label_templates SET is_default = false WHERE customer_id = ${customer_id} AND id != ${id}`;
      } else {
        await sql`UPDATE label_templates SET is_default = false WHERE customer_id IS NULL AND id != ${id}`;
      }
    }

    const result = await sql`
      UPDATE label_templates 
      SET 
        customer_id = ${customer_id || null},
        template_name = ${template_name},
        label_width_mm = ${label_width_mm},
        label_height_mm = ${label_height_mm},
        show_logo = ${show_logo !== false},
        show_company_name = ${show_company_name !== false},
        show_customer_name = ${show_customer_name !== false},
        show_lot_number = ${show_lot_number !== false},
        show_producer = ${show_producer !== false},
        show_orchard = ${show_orchard !== false},
        show_caliber = ${show_caliber !== false},
        show_class = ${show_class !== false},
        show_weight = ${show_weight !== false},
        show_boxes = ${show_boxes !== false},
        show_packing_date = ${show_packing_date !== false},
        show_barcode = ${show_barcode !== false},
        show_qr = ${show_qr !== false},
        logo_size = ${logo_size || 40},
        font_size_title = ${font_size_title || 16},
        font_size_body = ${font_size_body || 12},
        font_size_small = ${font_size_small || 8},
        background_color = ${background_color || '#FFFFFF'},
        text_color = ${text_color || '#000000'},
        border_color = ${border_color || '#000000'},
        header_text = ${header_text || ''},
        footer_text = ${footer_text || ''},
        custom_fields = ${JSON.stringify(custom_fields || {})},
        is_default = ${is_default || false},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating label template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    await sql`DELETE FROM label_templates WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting label template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
