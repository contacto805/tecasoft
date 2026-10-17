import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const area = searchParams.get("area");

    // Connect to official documentation as configurable engine (SRRC / Inocuidad templates)
    const official = await sql`
      SELECT id, template_name as name, description, category, document_type 
      FROM official_documentation_templates 
      WHERE (category ILIKE '%inocuidad%' OR category ILIKE '%srrc%' OR category ILIKE '%calidad%') AND is_active = true
      ORDER BY template_name ASC LIMIT 50
    `;

    // Local criteria (linked to templates)
    const local = await sql`SELECT * FROM inocuidad_criteria WHERE is_active = true ORDER BY name ASC LIMIT 50`;

    // If specific lot, also return linked inspections/evidences by ref (no copy)
    let linked = [];
    if (lotId) {
      linked = await sql`
        SELECT i.*, e.file_url, e.original_name 
        FROM inocuidad_inspections i 
        LEFT JOIN inocuidad_evidences e ON e.inspection_id = i.id 
        WHERE i.lot_id = ${parseInt(lotId)} OR i.cutting_order_id IN (SELECT id FROM cutting_orders WHERE lot_id = ${parseInt(lotId)} LIMIT 1)
        ORDER BY i.inspection_date DESC LIMIT 20
      `;
    }

    return NextResponse.json({ criteria: [...official, ...local], linked, actualizado: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ criteria: [], linked: [] });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // Admin/config: create or link criteria to official template
    const [row] = await sql`
      INSERT INTO inocuidad_criteria (name, description, frequency_days, responsible_role, checklist, linked_template_id, state)
      VALUES (${body.name}, ${body.description || ''}, ${body.frequency_days || 7}, ${body.responsible_role || ''}, ${JSON.stringify(body.checklist || [])}, ${body.linked_template_id || null}, 'activo')
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
