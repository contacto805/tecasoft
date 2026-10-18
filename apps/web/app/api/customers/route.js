import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forSelect = searchParams.get('forSelect');
    const id = searchParams.get('id');
    const withFiscal = searchParams.get('withFiscal') === 'true';
    
    let query = sql`SELECT * FROM customers ORDER BY customer_name ASC`;
    if (id) {
      query = sql`SELECT * FROM customers WHERE id = ${parseInt(id)} LIMIT 1`;
    }
    
    const customers = await query;

    const enriched = await Promise.all(customers.map(async (c) => {
      const fiscalComplete = !!(c.fiscal_rfc && c.fiscal_razon_social && c.fiscal_codigo_postal && c.fiscal_regimen_fiscal);
      let banks = [];
      try {
        banks = await sql`SELECT * FROM customer_bank_accounts WHERE customer_id = ${c.id} ORDER BY is_primary DESC, created_at DESC`;
      } catch (_) {}
      return {
        ...c,
        datos_fiscales_completos: fiscalComplete,
        fiscal_ok: fiscalComplete,
        fiscal_rfc: c.fiscal_rfc || c.rfc || null,
        fiscal_razon_social: c.fiscal_razon_social || c.commercial_name || c.customer_name,
        fiscal_codigo_postal: c.fiscal_codigo_postal || null,
        fiscal_regimen_fiscal: c.fiscal_regimen_fiscal || null,
        fiscal_uso_cfdi: c.fiscal_uso_cfdi || 'G03',
        fiscal_metodo_pago: c.fiscal_metodo_pago || 'PUE',
        fiscal_forma_pago: c.fiscal_forma_pago || '03',
        fiscal_email_facturacion: c.fiscal_email_facturacion || c.email || null,
        commercial_status: c.commercial_status || 'Activo',
        payment_terms_days: c.payment_terms_days || 30,
        credit_limit_usd: parseFloat(c.credit_limit_usd || 0),
        default_currency: c.default_currency || 'USD',
        delivery_address: c.delivery_address || null,
        estado_documental: c.estado_documental || 'Pendiente',
        bank_accounts: banks,
        primary_bank: banks.find(b => b.is_primary) || banks[0] || null
      };
    }));

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
        fiscal_ok: c.fiscal_ok,
        commercial_status: c.commercial_status
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
    
    // Server-side validation
    if (!data.customerName || String(data.customerName).trim().length < 2) {
      return NextResponse.json({ error: 'Nombre de cliente requerido' }, { status: 400 });
    }
    if (data.credit_limit_usd && parseFloat(data.credit_limit_usd) < 0) {
      return NextResponse.json({ error: 'Límite de crédito no puede ser negativo' }, { status: 400 });
    }

    // Safer client number generation (avoid race by check)
    let clientNumber = data.clientNumber || data.client_number;
    if (!clientNumber) {
      // Try up to 3 times for uniqueness
      for (let attempt = 0; attempt < 3; attempt++) {
        const maxRes = await sql`
          SELECT client_number FROM customers 
          WHERE client_number LIKE 'CLI-%' 
          ORDER BY client_number DESC 
          LIMIT 1
        `;
        let next = 1;
        if (maxRes.length > 0 && maxRes[0].client_number) {
          const existingNum = parseInt(String(maxRes[0].client_number).replace('CLI-', '')) || 0;
          next = existingNum + 1 + attempt;
        }
        clientNumber = 'CLI-' + String(next).padStart(4, '0');
        
        // Verify unique
        const exists = await sql`SELECT id FROM customers WHERE client_number = ${clientNumber} LIMIT 1`;
        if (!exists.length) break;
      }
    }

    const result = await sql`
      INSERT INTO customers (
        customer_name, commercial_name, contact_name, 
        rfc, address, phone, email, 
        destination, preferred_caliber, notes,
        manifest_code, manifest_requirements, client_number,
        commercial_status, payment_terms_days, credit_limit_usd, default_currency, delivery_address,
        fiscal_rfc, fiscal_razon_social, fiscal_codigo_postal, fiscal_regimen_fiscal,
        fiscal_uso_cfdi, fiscal_metodo_pago, fiscal_forma_pago, fiscal_email_facturacion
      ) VALUES (
        ${data.customerName}, ${data.commercialName || data.customerName || null}, ${data.contactName || null}, 
        ${data.rfc || null}, ${data.address || null}, 
        ${data.phone || null}, ${data.email || null}, ${data.destination || null},
        ${data.preferredCaliber || null}, ${data.notes || null},
        ${data.manifestCode || null}, ${data.manifestRequirements || null},
        ${clientNumber},
        ${data.commercialStatus || 'Activo'}, ${data.paymentTermsDays || 30}, ${parseFloat(data.creditLimitUsd || 0)}, ${data.defaultCurrency || 'USD'}, ${data.deliveryAddress || null},
        ${data.fiscalRfc || data.rfc || null}, ${data.fiscalRazonSocial || data.commercialName || data.customerName || null},
        ${data.fiscalCodigoPostal || null}, ${data.fiscalRegimenFiscal || null},
        ${data.fiscalUsoCfdi || 'G03'}, ${data.fiscalMetodoPago || 'PUE'}, ${data.fiscalFormaPago || '03'},
        ${data.fiscalEmailFacturacion || data.email || null}
      )
      RETURNING *
    `;
    
    // Audit
    try {
      await sql`
        INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, new_value, description)
        VALUES ('sistema', 'Sistema', 'clientes', 'CREATE', 'customer', ${result[0].id}, ${JSON.stringify({ client_number: clientNumber, name: data.customerName })}, 'Cliente creado desde catálogo maestro')
      `;
    } catch (_) {}

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    if (!data.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    if (data.credit_limit_usd && parseFloat(data.credit_limit_usd) < 0) {
      return NextResponse.json({ error: 'Límite de crédito no puede ser negativo' }, { status: 400 });
    }

    // Fetch old for audit
    const [old] = await sql`SELECT * FROM customers WHERE id = ${data.id} LIMIT 1`;

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
        commercial_status = COALESCE(${data.commercialStatus || null}, commercial_status),
        payment_terms_days = COALESCE(${data.paymentTermsDays || null}, payment_terms_days),
        credit_limit_usd = COALESCE(${data.creditLimitUsd != null ? parseFloat(data.creditLimitUsd) : null}, credit_limit_usd),
        default_currency = COALESCE(${data.defaultCurrency || null}, default_currency),
        delivery_address = COALESCE(${data.deliveryAddress || null}, delivery_address),
        fiscal_rfc = COALESCE(${data.fiscalRfc || null}, fiscal_rfc),
        fiscal_razon_social = COALESCE(${data.fiscalRazonSocial || null}, fiscal_razon_social),
        fiscal_codigo_postal = COALESCE(${data.fiscalCodigoPostal || null}, fiscal_codigo_postal),
        fiscal_regimen_fiscal = COALESCE(${data.fiscalRegimenFiscal || null}, fiscal_regimen_fiscal),
        fiscal_uso_cfdi = COALESCE(${data.fiscalUsoCfdi || null}, fiscal_uso_cfdi),
        fiscal_metodo_pago = COALESCE(${data.fiscalMetodoPago || null}, fiscal_metodo_pago),
        fiscal_forma_pago = COALESCE(${data.fiscalFormaPago || null}, fiscal_forma_pago),
        fiscal_email_facturacion = COALESCE(${data.fiscalEmailFacturacion || null}, fiscal_email_facturacion),
        updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING *
    `;
    
    // Audit change (exclude secrets)
    try {
      const changed = { before: { name: old?.customer_name }, after: { name: data.customerName } };
      await sql`
        INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, old_value, new_value, description)
        VALUES ('sistema', 'Sistema', 'clientes', 'UPDATE', 'customer', ${data.id}, ${JSON.stringify(changed.before)}, ${JSON.stringify(changed.after)}, 'Expediente cliente actualizado')
      `;
    } catch (_) {}

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
