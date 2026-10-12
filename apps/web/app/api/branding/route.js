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
      font_family: settings.font_family || 'Inter, system-ui, sans-serif',
      company_name: settings.company_name || 'TECAVO FRUITS',
    });
  } catch (e) {
    return NextResponse.json({
      primary_color: '#0E4A22',
      secondary_color: '#963821',
      accent_color: '#E0DA62',
      text_color: '#111827',
      logo_url: null,
      font_family: 'sans-serif',
      company_name: 'TECAVO FRUITS',
    });
  }
}
