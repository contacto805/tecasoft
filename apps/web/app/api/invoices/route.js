import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Get single invoice with items
      const invoice = await sql`
        SELECT * FROM invoices WHERE id = ${id}
      `;
      
      if (invoice.length === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      const items = await sql`
        SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY id
      `;

      return NextResponse.json({ ...invoice[0], items });
    } else {
      // Get all invoices
      const invoices = await sql`
        SELECT 
          i.*,
          COUNT(ii.id) as item_count
        FROM invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        WHERE i.status = 'active'
        GROUP BY i.id
        ORDER BY i.invoice_date DESC, i.created_at DESC
      `;
      
      return NextResponse.json(invoices);
    }
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      invoice_number,
      customer_name,
      customer_rfc,
      customer_address,
      invoice_date,
      subtotal,
      tax,
      total,
      notes,
      items
    } = data;

    // Validación de campos obligatorios
    if (!invoice_number || !invoice_number.trim()) {
      return NextResponse.json({ error: "El número de factura es obligatorio" }, { status: 400 });
    }

    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    if (!invoice_date) {
      return NextResponse.json({ error: "La fecha de factura es obligatoria" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un artículo" }, { status: 400 });
    }

    if (!subtotal || subtotal <= 0) {
      return NextResponse.json({ error: "El subtotal debe ser mayor a 0" }, { status: 400 });
    }

    // Insert invoice
    const invoiceResult = await sql`
      INSERT INTO invoices (
        invoice_number,
        customer_name,
        customer_rfc,
        customer_address,
        invoice_date,
        subtotal,
        tax,
        total,
        notes,
        status
      ) VALUES (
        ${invoice_number.trim()},
        ${customer_name.trim()},
        ${customer_rfc ? customer_rfc.trim() : null},
        ${customer_address ? customer_address.trim() : null},
        ${invoice_date},
        ${parseFloat(subtotal)},
        ${parseFloat(tax)},
        ${parseFloat(total)},
        ${notes ? notes.trim() : null},
        'active'
      )
      RETURNING *
    `;

    const invoiceId = invoiceResult[0].id;

    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.product_name || !item.product_name.trim()) {
          throw new Error("El nombre del producto es obligatorio");
        }
        
        const quantity = parseFloat(item.quantity);
        const unit_price = parseFloat(item.unit_price);
        
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("La cantidad debe ser mayor a 0");
        }
        
        if (isNaN(unit_price) || unit_price <= 0) {
          throw new Error("El precio unitario debe ser mayor a 0");
        }
        
        const itemSubtotal = Math.round(quantity * unit_price * 100) / 100;
        
        await sql`
          INSERT INTO invoice_items (
            invoice_id,
            product_name,
            quantity,
            unit_price,
            subtotal
          ) VALUES (
            ${invoiceId},
            ${item.product_name.trim()},
            ${quantity},
            ${unit_price},
            ${itemSubtotal}
          )
        `;
      }
    }

    // Get complete invoice with items
    const completeInvoice = await sql`
      SELECT * FROM invoices WHERE id = ${invoiceId}
    `;

    const invoiceItems = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}
    `;

    return NextResponse.json(
      { ...completeInvoice[0], items: invoiceItems },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const {
      id,
      invoice_number,
      customer_name,
      customer_rfc,
      customer_address,
      invoice_date,
      subtotal,
      tax,
      total,
      notes,
      items
    } = data;

    // Validación de campos obligatorios
    if (!invoice_number || !invoice_number.trim()) {
      return NextResponse.json({ error: "El número de factura es obligatorio" }, { status: 400 });
    }

    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    if (!invoice_date) {
      return NextResponse.json({ error: "La fecha de factura es obligatoria" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un artículo" }, { status: 400 });
    }

    if (!subtotal || subtotal <= 0) {
      return NextResponse.json({ error: "El subtotal debe ser mayor a 0" }, { status: 400 });
    }

    // Update invoice
    await sql`
      UPDATE invoices
      SET
        invoice_number = ${invoice_number.trim()},
        customer_name = ${customer_name.trim()},
        customer_rfc = ${customer_rfc ? customer_rfc.trim() : null},
        customer_address = ${customer_address ? customer_address.trim() : null},
        invoice_date = ${invoice_date},
        subtotal = ${parseFloat(subtotal)},
        tax = ${parseFloat(tax)},
        total = ${parseFloat(total)},
        notes = ${notes ? notes.trim() : null},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Delete old items
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;

    // Insert new items
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.product_name || !item.product_name.trim()) {
          throw new Error("El nombre del producto es obligatorio");
        }
        
        const quantity = parseFloat(item.quantity);
        const unit_price = parseFloat(item.unit_price);
        
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("La cantidad debe ser mayor a 0");
        }
        
        if (isNaN(unit_price) || unit_price <= 0) {
          throw new Error("El precio unitario debe ser mayor a 0");
        }
        
        const itemSubtotal = Math.round(quantity * unit_price * 100) / 100;
        
        await sql`
          INSERT INTO invoice_items (
            invoice_id,
            product_name,
            quantity,
            unit_price,
            subtotal
          ) VALUES (
            ${id},
            ${item.product_name.trim()},
            ${quantity},
            ${unit_price},
            ${itemSubtotal}
          )
        `;
      }
    }

    // Get updated invoice
    const updatedInvoice = await sql`
      SELECT * FROM invoices WHERE id = ${id}
    `;

    const invoiceItems = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${id}
    `;

    return NextResponse.json({ ...updatedInvoice[0], items: invoiceItems });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Soft delete
    await sql`
      UPDATE invoices 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
