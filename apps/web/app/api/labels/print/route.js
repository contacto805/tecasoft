import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { lot_id, template_id, quantity = 1 } = await request.json();

    if (!lot_id || !template_id) {
      return NextResponse.json(
        { error: "lot_id y template_id son requeridos" },
        { status: 400 }
      );
    }

    // Get lot details
    const [lot] = await sql`
      SELECT 
        l.*,
        COALESCE(SUM(li.total_kg), 0) as total_kg_inventory,
        COUNT(DISTINCT li.caliber) as caliber_count
      FROM lots l
      LEFT JOIN lot_inventory li ON l.id = li.lot_id
      WHERE l.id = ${lot_id}
      GROUP BY l.id
    `;

    if (!lot) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }

    // Get template
    const [template] = await sql`
      SELECT * FROM label_templates WHERE id = ${template_id}
    `;

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    // Get inventory details by caliber
    const inventory = await sql`
      SELECT caliber, class_name, SUM(total_kg) as total_kg
      FROM lot_inventory
      WHERE lot_id = ${lot_id}
      GROUP BY caliber, class_name
      ORDER BY caliber, class_name
    `;

    // Get branding info
    const branding = await sql`SELECT * FROM system_settings WHERE key = 'company_info'`;
    let companyInfo = {};
    if (branding && branding.length > 0 && branding[0].value) {
      try {
        companyInfo = JSON.parse(branding[0].value);
      } catch (e) {
        console.error("Error parsing company info:", e);
      }
    }

    // Create label data
    const labelData = {
      lot_number: lot.lot_number,
      producer: lot.producer,
      orchard: lot.orchard_name || lot.origin,
      fruit_type: lot.fruit_type,
      date: lot.date,
      total_kg: lot.total_kg_inventory,
      inventory_details: inventory,
      company_name: companyInfo.company_name || "Mi Empacadora",
      company_logo: companyInfo.logo_url || null,
      customer_name: lot.client_name || lot.destination,
      template: template,
      quantity: quantity
    };

    // Log print job
    await sql`
      INSERT INTO label_print_log (
        lot_id, template_id, label_data, quantity, printed_by
      ) VALUES (
        ${lot_id}, ${template_id}, ${JSON.stringify(labelData)}, 
        ${quantity}, 'system'
      )
    `;

    return NextResponse.json({
      success: true,
      labelData,
      message: `${quantity} etiqueta(s) lista(s) para imprimir`
    });
  } catch (error) {
    console.error("Error preparing label print:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
