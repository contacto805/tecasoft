import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const settingsRows = await sql`SELECT key, value FROM system_settings`;
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const schemes = await sql`SELECT * FROM color_schemes ORDER BY module_name`;
    const brandingScheme = schemes.find(s => s.module_name === 'branding') || {};

    return NextResponse.json({
      primary_color: brandingScheme.primary_color || settings.primary_color || '#0E4A22',
      secondary_color: brandingScheme.secondary_color || settings.secondary_color || '#963821',
      accent_color: brandingScheme.accent_color || '#E0DA62',
      text_color: brandingScheme.text_color || '#111827',
      background_color: brandingScheme.background_color || '#ffffff',
      logo_url: settings.logo_url || brandingScheme.logo_url || null,
      excel_plantilla_url: settings.excel_plantilla_url || null,
      font_family: settings.font_family || 'Inter, system-ui, sans-serif',
      company_name: settings.company_name || 'TECAVO FRUITS',
      heading_font_family: settings.heading_font_family || settings.font_family || 'sans-serif',
      body_font_family: settings.body_font_family || settings.font_family || 'sans-serif',
    });
  } catch (e) {
    return NextResponse.json({
      primary_color: '#0E4A22',
      secondary_color: '#963821',
      accent_color: '#E0DA62',
      text_color: '#111827',
      logo_url: null,
      excel_plantilla_url: null,
      font_family: 'sans-serif',
      company_name: 'TECAVO FRUITS',
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { primary_color, secondary_color, accent_color, font_family, heading_font_family, body_font_family, logo_url, excel_plantilla_url } = body || {};

    // Update system_settings for core branding
    if (primary_color) await sql`INSERT INTO system_settings (key, value) VALUES ('primary_color', ${primary_color}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (secondary_color) await sql`INSERT INTO system_settings (key, value) VALUES ('secondary_color', ${secondary_color}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (accent_color) await sql`INSERT INTO system_settings (key, value) VALUES ('accent_color', ${accent_color}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (font_family) await sql`INSERT INTO system_settings (key, value) VALUES ('font_family', ${font_family}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (heading_font_family) await sql`INSERT INTO system_settings (key, value) VALUES ('heading_font_family', ${heading_font_family}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (body_font_family) await sql`INSERT INTO system_settings (key, value) VALUES ('body_font_family', ${body_font_family}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (logo_url) await sql`INSERT INTO system_settings (key, value) VALUES ('logo_url', ${logo_url}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    if (excel_plantilla_url) await sql`INSERT INTO system_settings (key, value) VALUES ('excel_plantilla_url', ${excel_plantilla_url}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;

    // Also upsert color_schemes for branding module (full columns to match schema)
    await sql`
      INSERT INTO color_schemes (module_name, primary_color, secondary_color, accent_color, text_color, background_color, bg_color, border_color, updated_at)
      VALUES ('branding', ${primary_color || '#0E4A22'}, ${secondary_color || '#963821'}, ${accent_color || '#E0DA62'}, '#111827', '#ffffff', '#ffffff', '#E2E8F0', NOW())
      ON CONFLICT (module_name) DO UPDATE SET 
        primary_color = COALESCE(${primary_color}, EXCLUDED.primary_color),
        secondary_color = COALESCE(${secondary_color}, EXCLUDED.secondary_color),
        accent_color = COALESCE(${accent_color}, EXCLUDED.accent_color),
        updated_at = NOW()
    `;

    // Audit (all columns to match schema)
    await sql`INSERT INTO system_audit_log (user_id, user_name, user_role, module, action, entity_type, entity_id, old_value, new_value, description, ip_address, user_agent, status, timestamp) 
      VALUES ('super', 'Superadministrador', 'super', 'branding', 'update', 'global_styles', 0, null, null, 'Actualización de paleta corporativa, fuentes e imagen institucional', null, null, 'success', NOW())`;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
