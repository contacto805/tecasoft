import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forSelect = searchParams.get('forSelect');
    const withFiscal = searchParams.get('withFiscal') === 'true';
    
    const customers = await sql`
      SELECT * FROM customers 
      ORDER BY customer_name ASC
    `;

    const enriched = customers.map(c => {
      const fiscalComplete = !!(c.fiscal_rfc && c.fiscal_razon_social && c.fiscal_codigo_postal && c.fiscal_regimen_fiscal);
      return {
        ...c,
        datos_fiscales_completos: fiscalComplete,
        fiscal_ok: fiscalComplete,
        // expose clean aliases for facturación
        fiscal_rfc: c.fiscal_rfc || c.rfc || null,
        fiscal_razon_social: c.fiscal_razon_social || c.commercial_name || c.customer_name,
        fiscal_codigo_postal: c.fiscal_codigo_postal || null,
        fiscal_regimen_fiscal: c.fiscal_regimen_fiscal || null,
        fiscal_uso_cfdi: c.fiscal_uso_cfdi || 'G03',
        fiscal_metodo_pago: c.fiscal_metodo_pago || 'PUE',
        fiscal_forma_pago: c.fiscal_forma_pago || '03',
        fiscal_email_facturacion: c.fiscal_email_facturacion || c.email || null
      };
    });

    if (forSelect === 'true') {
      return NextResponse.json(enriched.map(c => ({
        id: c.id,
        name: c.customer_name,
        commercialName: c.commercial_name || c.customer_name,
        contactName: c.contact_name,
        clientNumber: c.client_number,
        destination: c.destination,
        preferredCaliber: c.preferred_caliber,
        manifestCode: c.manifest_code,
        manifestRequirements: c.manifest_requirements,
        fiscal_rfc: c.fiscal_rfc,
        fiscal_ok: c.fiscal_ok
      })));
    }

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Auto-assign unique irrepetible client number if not provided
    let clientNumber = data.clientNumber || data.client_number;
    if (!clientNumber) {
      const maxRes = await sql`
        SELECT client_number FROM customers 
        WHERE client_number LIKE 'CLI-%' 
        ORDER BY client_number DESC 
        LIMIT 1
      `;
      let next = 1;
      if (maxRes.length > 0 && maxRes[0].client_number) {
        const existingNum = parseInt(String(maxRes[0].client_number).replace('CLI-', '')) || 0;
        next = existingNum + 1;
      }
      clientNumber = 'CLI-' + String(next).padStart(4, '0');
    }
    
    const result = await sql`
      INSERT INTO customers (
        customer_name, commercial_name, contact_name, 
        rfc, address, phone, email, 
        destination, preferred_caliber, notes,
        manifest_code, manifest_requirements, client_number
      ) VALUES (
        ${data.customerName}, ${data.commercialName || data.customerName || null}, ${data.contactName || null}, 
        ${data.rfc || null}, ${data.address || null}, 
        ${data.phone || null}, ${data.email || null}, ${data.destination || null},
        ${data.preferredCaliber || null}, ${data.notes || null},
        ${data.manifestCode || null}, ${data.manifestRequirements || null},
        ${clientNumber}
      )
      RETURNING *
    `;
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    
    const result = await sql`
      UPDATE customers SET
        customer_name = ${data.customerName},
        commercial_name = ${data.commercialName || null},
        contact_name = ${data.contactName || null},
        rfc = ${data.rfc || null},
        address = ${data.address || null},
        phone = ${data.phone || null},
        email = ${data.email || null},
        destination = ${data.destination || null},
        preferred_caliber = ${data.preferredCaliber || null},
        notes = ${data.notes || null},
        manifest_code = ${data.manifestCode || null},
        manifest_requirements = ${data.manifestRequirements || null},
        client_number = COALESCE(${data.clientNumber || data.client_number || null}, client_number),
        updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING *
    `;
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await sql`DELETE FROM customers WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
