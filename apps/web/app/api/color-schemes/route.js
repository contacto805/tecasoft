import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const colorSchemes = await sql`
      SELECT * FROM color_schemes
      ORDER BY module_name
    `;
    
    return NextResponse.json(colorSchemes);
  } catch (error) {
    console.error('Error fetching color schemes:', error);
    return NextResponse.json({ error: 'Error al obtener esquemas de color' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Aceptar tanto array de esquemas como objeto individual
    const schemes = Array.isArray(data) ? data : [data];

    // Guardar o actualizar cada esquema
    for (const scheme of schemes) {
      const { module_name, primary_color, secondary_color, accent_color, text_color, bg_color, border_color, background_color } = scheme;
      
      if (!module_name) continue;

      const p = primary_color || '#10b981';
      const s = secondary_color || '#34d399';
      const a = accent_color || '#6ee7b7';
      const t = text_color || '#0f172a';
      const b = bg_color || '#ffffff';
      const br = border_color || '#e2e8f0';
      const bg = background_color || null;

      // upsert using check (no ON CONFLICT needed without unique)
      const existing = await sql`SELECT id FROM color_schemes WHERE module_name = ${module_name} LIMIT 1`;
      if (existing.length > 0) {
        await sql`
          UPDATE color_schemes SET
            primary_color = ${p},
            secondary_color = ${s},
            accent_color = ${a},
            text_color = ${t},
            bg_color = ${b},
            border_color = ${br},
            background_color = ${bg},
            updated_at = CURRENT_TIMESTAMP
          WHERE module_name = ${module_name}
        `;
      } else {
        await sql`
          INSERT INTO color_schemes (
            module_name, primary_color, secondary_color, accent_color, 
            text_color, bg_color, border_color, background_color
          )
          VALUES (${module_name}, ${p}, ${s}, ${a}, ${t}, ${b}, ${br}, ${bg})
        `;
      }
    }

    return NextResponse.json({ success: true, message: 'Esquemas de color guardados exitosamente' });
  } catch (error) {
    console.error('Error saving color schemes:', error);
    return NextResponse.json({ error: 'Error al guardar esquemas de color' }, { status: 500 });
  }
}
