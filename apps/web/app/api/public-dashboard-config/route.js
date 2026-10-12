import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM public_dashboard_config 
      ORDER BY updated_at DESC NULLS LAST, id DESC 
      LIMIT 1
    `;
    return NextResponse.json(rows[0] || { 
      header_image_url: null, 
      template_image_url: null,
      company_name: "Tecavo",
      primary_color: "#0f172a"
    });
  } catch (e) {
    return NextResponse.json({ 
      header_image_url: null, 
      template_image_url: null
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { header_image_url, template_image_url, company_name } = body;

    // Upsert simple: delete other actives, keep last one as active template
    const [existing] = await sql`SELECT id FROM public_dashboard_config LIMIT 1`;

    if (existing) {
      const [updated] = await sql`
        UPDATE public_dashboard_config 
        SET 
          header_image_url = COALESCE(${header_image_url}, header_image_url),
          template_image_url = COALESCE(${template_image_url}, template_image_url),
          company_name = COALESCE(${company_name}, company_name),
          updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING *
      `;
      return NextResponse.json(updated);
    } else {
      const [created] = await sql`
        INSERT INTO public_dashboard_config (header_image_url, template_image_url, company_name, is_active, created_at, updated_at)
        VALUES (${header_image_url || null}, ${template_image_url || null}, ${company_name || 'Tecavo'}, true, NOW(), NOW())
        RETURNING *
      `;
      return NextResponse.json(created);
    }
  } catch (e) {
    console.error('public-dashboard-config POST', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}