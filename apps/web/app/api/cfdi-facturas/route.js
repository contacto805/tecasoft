import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const uso = searchParams.get("uso");

    let q = sql`
      SELECT f.*, c.customer_name 
      FROM cfdi_facturas f 
      LEFT JOIN customers c ON f.customer_id = c.id 
      ORDER BY f.fecha_timbrado DESC LIMIT 100
    `;
    if (customerId) {
      q = sql`
        SELECT f.*, c.customer_name 
        FROM cfdi_facturas f LEFT JOIN customers c ON f.customer_id = c.id 
        WHERE f.customer_id = ${parseInt(customerId)} ORDER BY f.fecha_timbrado DESC
      `;
    }
    const rows = await q;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error facturas" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { customerId, uso_factura, action, ...rest } = data;

    // If action=timbrar, delegate to central Senhub integration (real API call)
    if (action === 'timbrar' || action === 'stamp') {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/facturacion/senhub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'timbrar', customer_id: customerId, uso_cfdi: uso_factura, ...rest })
      });
      const out = await res.json();
      return NextResponse.json(out, { status: res.ok ? 200 : 400 });
    }

    const [row] = await sql`
      INSERT INTO cfdi_facturas (
        folio_interno, serie, uuid, fecha_timbrado, customer_id, rfc_cliente, 
        moneda, importe, importe_usd, viaje_id, nota_id, uso_factura,
        fecha_cruce, pedimento, aduana, agente_aduanal, observaciones, pdf_url, xml_url, estatus, created_by
      ) VALUES (
        ${rest.folio_interno || null}, ${rest.serie || null}, ${rest.uuid || null}, ${rest.fecha_timbrado || null},
        ${parseInt(customerId)}, ${rest.rfc_cliente || null}, ${rest.moneda || 'USD'},
        ${parseFloat(rest.importe) || 0}, ${parseFloat(rest.importe_usd) || 0}, ${rest.viaje_id ? parseInt(rest.viaje_id) : null},
        ${rest.nota_id ? parseInt(rest.nota_id) : null}, ${uso_factura || 'SOLO TIMBRADA PARA DEPÓSITO'},
        ${rest.fecha_cruce || null}, ${rest.pedimento || null}, ${rest.aduana || null},
        ${rest.agente_aduanal || null}, ${rest.observaciones || null}, ${rest.pdf_url || null}, ${rest.xml_url || null},
        ${rest.estatus || 'Timbrada'}, ${rest.created_by || 'sistema'}
      ) RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error crear factura CFDI" }, { status: 500 });
  }
}
