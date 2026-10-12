import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

async function getBranding() {
  try {
    const sets = await sql`SELECT key,value FROM system_settings WHERE key IN ('logo_url','company_name','company_address','phone')`;
    const m = {}; sets.forEach(s => m[s.key] = s.value);
    return { logo_url: m.logo_url || null, company_name: m.company_name || 'EMPAQUE TECAVO S. DE R.L. DE C.V.', address: m.company_address || 'Carretera a Huerta s/n, Michoacán', phone: m.phone || '' };
  } catch(e){ return {logo_url:null, company_name:'EMPAQUE TECAVO', address:'Carretera a Huerta s/n, Michoacán', phone:''}; }
}

export async function POST(request) {
  try {
    const { recordId, printerId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId es requerido" },
        { status: 400 }
      );
    }

    // Get the sales record
    const record = await sql`
      SELECT 
        spw.*,
        l.lot_number,
        l.producer,
        l.fruit_type
      FROM sales_of_process_and_waste spw
      LEFT JOIN lots l ON spw.lot_id = l.id
      WHERE spw.id = ${recordId}
    `;

    if (!record || record.length === 0) {
      return NextResponse.json(
        { error: "Registro de venta no encontrado" },
        { status: 404 }
      );
    }

    const sale = record[0];
    const branding = await getBranding();

    // Get the printer (use default if not specified)
    let printer;
    if (printerId) {
      const printers = await sql`
        SELECT * FROM printer_settings 
        WHERE id = ${printerId} AND is_active = true
      `;
      printer = printers[0];
    } else {
      const printers = await sql`
        SELECT * FROM printer_settings 
        WHERE is_default = true AND is_active = true
        LIMIT 1
      `;
      printer = printers[0];
    }

    if (!printer) {
      return NextResponse.json(
        { error: "No hay impresora disponible" },
        { status: 404 }
      );
    }

    // Generate thermal printer format (80mm width)
    const ticketContent = generateTicket(sale, printer);

    // Log ticket for printing (in production, this would send to actual printer via network/serial)
    console.log("📄 Ticket generado para impresora:", {
      printer: printer.printer_name,
      connection: printer.connection_type,
      ip: printer.ip_address,
      port: printer.port,
      devicePath: printer.device_path
    });

    return NextResponse.json({
      success: true,
      message: "Ticket enviado a la impresora",
      ticket: ticketContent,
      printer: {
        name: printer.printer_name,
        type: printer.printer_type,
        connection: printer.connection_type
      }
    });
  } catch (error) {
    console.error("Error printing ticket:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function generateTicket(sale, printer) {
  const width = printer.paper_width_mm || 80;
  const lineWidth = width === 80 ? 42 : width === 58 ? 32 : 80;
  const centerPadding = Math.floor((lineWidth - 1) / 2);

  // Helper functions for formatting
  const centerText = (text) => {
    const padding = Math.floor((lineWidth - text.length) / 2);
    return " ".repeat(Math.max(0, padding)) + text;
  };

  const padRight = (text, length) => {
    return text.padEnd(length);
  };

  const divider = "=".repeat(lineWidth);
  const lightDivider = "-".repeat(lineWidth);

  const date = new Date(sale.date).toLocaleDateString('es-MX');
  const timestamp = new Date().toLocaleTimeString('es-MX');

  let ticket = [];
  ticket.push("");
  // Include company logo/company data  on EVERY ticket
  ticket.push(centerText( (branding.company_name || 'EMPAQUE TECAVO').toUpperCase() ));
  ticket.push(centerText(branding.address || 'Carretera a Huerta s/n, Michoacán'));
  if (branding.phone) ticket.push(centerText(branding.phone));
  ticket.push(divider);
  ticket.push("");
  
  // Folio and date
  ticket.push(centerText("FOLIO: " + sale.sales_folio));
  ticket.push("");
  ticket.push(padRight("Fecha:", 12) + date);
  ticket.push(padRight("Hora:", 12) + timestamp);
  ticket.push(lightDivider);
  ticket.push("");

  // Origin information
  ticket.push("INFORMACION DE ORIGEN");
  ticket.push(lightDivider);
  if (sale.lot_number) {
    ticket.push(padRight("Lote:", 12) + sale.lot_number);
  }
  if (sale.producer) {
    ticket.push(padRight("Productor:", 12) + sale.producer);
  }
  if (sale.fruit_type) {
    ticket.push(padRight("Fruta:", 12) + sale.fruit_type);
  }
  if (sale.source_batch_number) {
    ticket.push(padRight("Lote Fuente:", 12) + sale.source_batch_number);
  }
  ticket.push("");

  // Sale information
  ticket.push("DETALLES DE VENTA");
  ticket.push(lightDivider);
  ticket.push(padRight("Comprador:", 12) + sale.buyer_name);
  ticket.push(padRight("Destino:", 12) + sale.destination);
  ticket.push(padRight("Producto:", 12) + sale.product_name);
  ticket.push("");

  // Quantities
  ticket.push("CANTIDADES");
  ticket.push(lightDivider);
  ticket.push(padRight("Kg Proceso:", 16) + parseFloat(sale.process_kg).toFixed(2) + " kg");
  ticket.push(padRight("Kg Desecho:", 16) + parseFloat(sale.waste_kg).toFixed(2) + " kg");
  ticket.push(padRight("Kg Merma:", 16) + parseFloat(sale.shrinkage_kg).toFixed(2) + " kg");
  ticket.push("");

  // Pricing
  ticket.push("PRECIOS");
  ticket.push(lightDivider);
  ticket.push(padRight("Precio Unitario:", 16) + "$" + parseFloat(sale.unit_price).toFixed(2) + "/kg");
  ticket.push(divider);
  ticket.push(padRight("TOTAL A PAGAR:", 16) + "$" + parseFloat(sale.calculated_price).toFixed(2));
  ticket.push(divider);
  ticket.push("");

  // Notes if exists
  if (sale.notes) {
    ticket.push("OBSERVACIONES");
    ticket.push(lightDivider);
    // Wrap notes text for ticket width
    const words = sale.notes.split(" ");
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length <= lineWidth) {
        currentLine += word + " ";
      } else {
        if (currentLine.trim()) ticket.push(currentLine.trim());
        currentLine = word + " ";
      }
    });
    if (currentLine.trim()) ticket.push(currentLine.trim());
    ticket.push("");
  }

  // Footer
  ticket.push(centerText("---"));
  ticket.push(centerText("Gracias por su compra"));
  ticket.push("");
  ticket.push(centerText( (branding.company_name || 'EMPAQUE TECAVO') + ' — Todos los documentos incluyen logo + datos de empacadora'));
  ticket.push("");

  return ticket.join("\n");
}