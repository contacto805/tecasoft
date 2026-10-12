import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activo = searchParams.get('activo') === 'true';
    
    if (activo) {
      const rows = await sql`SELECT * FROM precios_fruta_publicados WHERE activo = true ORDER BY id DESC LIMIT 1`;
      return NextResponse.json(rows?.[0] || null);
    }
    
    const rows = await sql`SELECT * FROM precios_fruta_publicados ORDER BY semana DESC, id DESC LIMIT 30`;
    return NextResponse.json(rows || []);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      semana, fecha_inicio, fecha_fin, tipo_calculo,
      super_extra, extra, primera, mediano, tercera, cuarta, proceso, canica, desecho,
      responsable, telefono_1, telefono_2, direccion, plantilla, imagen_url, usuario_publico
    } = body;

    // deactivate older actives before inserting new
    await sql`UPDATE precios_fruta_publicados SET activo = false WHERE activo = true`;

    const result = await sql`
      INSERT INTO precios_fruta_publicados 
      (semana, fecha_inicio, fecha_fin, tipo_calculo,
       super_extra, extra, primera, mediano, tercera, cuarta, proceso, canica, desecho,
       responsable, telefono_1, telefono_2, direccion, plantilla, imagen_url, usuario_publico, activo)
      VALUES 
      (${semana || 1}, ${fecha_inicio || new Date().toISOString().slice(0,10)}, ${fecha_fin || new Date().toISOString().slice(0,10)}, ${tipo_calculo || 'compra'},
       ${super_extra || 0}, ${extra || 0}, ${primera || 0}, ${mediano || 0}, ${tercera || 0}, ${cuarta || 0}, ${proceso || 0}, ${canica || 0}, ${desecho || 0},
       ${responsable || 'Superadmin'}, ${telefono_1 || ''}, ${telefono_2 || ''}, ${direccion || ''}, ${plantilla || 'premium'}, ${imagen_url || null}, ${usuario_publico || 'super'}, true)
      RETURNING *
    `;
    return NextResponse.json(result[0] || { success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, super_extra, extra, primera, mediano, tercera, cuarta, proceso, desecho, imagen_url, semana } = body;
    const rowId = id || null;
    if (!rowId) {
      // update latest if ID not given
      const latest = await sql`SELECT id FROM precios_fruta_publicados ORDER BY id DESC LIMIT 1`;
      if (!latest.length) return NextResponse.json({ error: 'No price row' }, { status: 404 });
      const target = latest[0].id;
      const res = await sql`
        UPDATE precios_fruta_publicados SET
          super_extra = ${super_extra}, extra = ${extra}, primera = ${primera}, mediano = ${mediano}, tercera = ${tercera}, cuarta = ${cuarta}, proceso = ${proceso}, desecho = ${desecho},
          imagen_url = COALESCE(${imagen_url}, imagen_url),
          semana = COALESCE(${semana}, semana),
          activo = true
        WHERE id = ${target} RETURNING *
      `;
      return NextResponse.json(res[0]);
    }
    const res = await sql`
      UPDATE precios_fruta_publicados SET
        super_extra = ${super_extra}, extra = ${extra}, primera = ${primera}, mediano = ${mediano}, tercera = ${tercera}, cuarta = ${cuarta}, proceso = ${proceso}, desecho = ${desecho},
        imagen_url = COALESCE(${imagen_url}, imagen_url),
        semana = COALESCE(${semana}, semana),
        activo = true
      WHERE id = ${rowId} RETURNING *
    `;
    return NextResponse.json(res[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 200 });
  }
}