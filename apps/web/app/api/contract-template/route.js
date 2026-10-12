import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [tpl] = await sql`
      SELECT base_text, updated_at, updated_by 
      FROM contract_templates 
      WHERE template_key = 'default_contract' 
      LIMIT 1
    `;
    return NextResponse.json({
      base_text: tpl?.base_text || "",
      updated_at: tpl?.updated_at || null,
      updated_by: tpl?.updated_by || null
    });
  } catch (e) {
    return NextResponse.json({ base_text: "", error: "No plantillas" }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const { base_text } = await request.json();
    if (!base_text || base_text.length < 20) {
      return NextResponse.json({ error: "Texto inválido" }, { status: 400 });
    }
    await sql`
      UPDATE contract_templates 
      SET base_text = ${base_text}, updated_at = NOW(), updated_by = 'admin' 
      WHERE template_key = 'default_contract'
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
