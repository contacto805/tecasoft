import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = await sql`SELECT * FROM sales_note_config ORDER BY id DESC LIMIT 1`;
    
    if (config.length === 0) {
      // Return default configuration
      return NextResponse.json({
        cliente: '',
        producto: '',
        cantidad: '',
        precio: '',
        fecha: '',
        destino: '',
        calibre: ''
      });
    }

    // Convert array to object
    const configMap = {};
    const fullConfig = await sql`SELECT * FROM sales_note_config WHERE id = ${config[0].id}`;
    fullConfig.forEach(row => {
      configMap[row.field_name] = row.column_mapping;
    });

    return NextResponse.json(configMap);
  } catch (error) {
    console.error('Error fetching sales note config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const config = await request.json();
    
    // Fetch existing to preserve other mappings when uploading single template
    let existing = {};
    try {
      const prev = await sql`SELECT * FROM sales_note_config`;
      prev.forEach(r => { existing[r.field_name] = r.column_mapping; });
    } catch(e){}
    
    // Merge new config with previous
    const merged = { ...existing, ...config };

    // Delete previous configuration
    await sql`DELETE FROM sales_note_config`;

    // Insert new merged
    const fields = ['cliente', 'producto', 'cantidad', 'precio', 'fecha', 'destino', 'calibre', 'xlsx_template_url', 'svg_template_url'];
    
    for (const field of fields) {
      if (merged[field]) {
        await sql`
          INSERT INTO sales_note_config (field_name, column_mapping)
          VALUES (${field}, ${merged[field]})
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Configuración guardada exitosamente' 
    });
  } catch (error) {
    console.error('Error saving sales note config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
