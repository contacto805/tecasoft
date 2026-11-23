import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";

const fields = new Set(['cliente','producto','cantidad','precio','fecha','destino','calibre',
  'xlsx_template_url','svg_template_url','pdf_template_url','pallet_template_url','pdf_top_margin']);

function validField(key,value) {
  if (value == null || value === '') return true;
  if (key === 'pdf_top_margin') return /^\d{1,3}$/.test(String(value)) && Number(value)>=20 && Number(value)<=200;
  if (typeof value !== 'string' || value.length>1500) return false;
  if (!key.endsWith('_url')) return true;
  return /^https:\/\/[^\s]+$/i.test(value) || /^\/(?!\/)[^\s]+$/.test(value);
}

export async function GET() {
  try {
    const config = await sql`SELECT DISTINCT ON (field_name) field_name,column_mapping
      FROM sales_note_config ORDER BY field_name,id DESC`;
    return NextResponse.json(Object.fromEntries(config.map(row=>[row.field_name,row.column_mapping])),
      {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('Consulta de plantillas:',error.message);
    return NextResponse.json({error:'No se pudieron consultar las plantillas.'},{status:500});
  }
}

export async function PUT(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:'Inicia sesión para guardar la plantilla.'},{status:401});
    const config = await request.json();
    const entries = Object.entries(config);
    if (!entries.length || entries.some(([key,value])=>!fields.has(key) || !validField(key,value))) {
      return NextResponse.json({error:'Plantilla o configuración inválida.'},{status:400});
    }
    const statements = [sql`SELECT pg_advisory_xact_lock(hashtext('tecavo-sales-note-config'))`];
    for (const [field,value] of entries) {
      statements.push(sql`DELETE FROM sales_note_config WHERE field_name=${field}`);
      if (value != null && value !== '') statements.push(sql`
        INSERT INTO sales_note_config(field_name,column_mapping) VALUES(${field},${String(value)})`);
    }
    await sql.transaction(statements);
    return NextResponse.json({success:true});
  } catch (error) {
    console.error('Guardar plantillas:',error.message);
    return NextResponse.json({error:'No se pudo guardar la plantilla.'},{status:500});
  }
}
