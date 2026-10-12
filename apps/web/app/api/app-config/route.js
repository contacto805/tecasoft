import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * /api/app-config
 * SINGLE SOURCE OF TRUTH for all frontend configuration.
 * Aggregates: system_settings + color_schemes + menu + operational rules.
 * Frontend should ONLY call this (useAppConfig).
 */

export async function GET() {
  try {
    // Company / branding
    const settingsRows = await sql`
      SELECT key, value FROM system_settings
    `;
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Color schemes (branding + dashboard)
    const schemes = await sql`
      SELECT * FROM color_schemes ORDER BY module_name
    `;
    const brandingScheme = schemes.find(s => s.module_name === 'branding') || {};
    const dashboardScheme = schemes.find(s => s.module_name === 'dashboard') || {};

    // Navigation (groups + modules with keys)
    const groups = await sql`
      SELECT * FROM menu_groups WHERE is_active IS NOT false ORDER BY group_order
    `;
    const modules = await sql`
      SELECT * FROM menu_modules WHERE is_active IS NOT false ORDER BY module_order
    `;

    const navigation = groups.map(g => ({
      id: g.id,
      group_key: g.group_key || g.group_name.toUpperCase().replace(/\s+/g, '_'),
      group_name: g.group_name,
      applies_to: g.applies_to,
      modules: modules
        .filter(m => m.group_id === g.id)
        .map(m => ({
          id: m.id,
          module_key: m.module_key || m.module_name.toUpperCase().replace(/\s+/g, '_'),
          module_name: m.module_name,
          display_name: m.display_name || m.module_name,
          module_route: m.module_route,
          module_icon: m.module_icon
        }))
    }));

    const config = {
      version: Date.now(),
      company: {
        name: settings.company_name || 'TECAVO FRUITS',
        legal_name: settings.company_legal_name || settings.company_name || 'Tecavo Fruits S de RL de CV',
        rfc: settings.rfc || '',
        sader: settings.sader_registry || '',
        address: settings.company_address || '',
        phone: settings.company_phone || '',
        email: settings.company_email || '',
        logo_url: settings.logo_url || null,
        secondary_logo_url: settings.secondary_logo_url || null,
        slogan: settings.slogan || 'Del campo con amor'
      },
      branding: {
        primary_color: brandingScheme.primary_color || dashboardScheme.primary_color || '#1F6B3A',
        secondary_color: brandingScheme.secondary_color || '#124A29',
        accent_color: brandingScheme.accent_color || '#E8F3EC',
        background_color: brandingScheme.background_color || '#FFFFFF',
        text_color: brandingScheme.text_color || '#111111'
      },
      theme: {
        primary: brandingScheme.primary_color || '#1F6B3A',
        '--color-primary': brandingScheme.primary_color || '#1F6B3A',
        '--color-secondary': brandingScheme.secondary_color || '#124A29',
        '--color-accent': brandingScheme.accent_color || '#E8F3EC',
        '--color-background': '#FFFFFF',
        '--color-surface': '#F8FAFC',
        '--color-text': '#111111',
        '--color-text-muted': '#64748B',
        '--color-border': '#E2E8F0',
        '--color-success': '#166534',
        '--color-warning': '#B45309',
        '--color-danger': '#DC2626'
      },
      typography: {
        font_family: settings.font_family || 'Inter, system-ui, sans-serif',
        heading_font_family: settings.heading_font_family || settings.font_family || 'Inter, system-ui, sans-serif',
        body_font_family: settings.body_font_family || settings.font_family || 'Inter, system-ui, sans-serif'
      },
      navigation,
      operational_rules: {
        default_presentation_kg: 10,
        price_source: 'price_weeks', // centralized
        time_zone: 'America/Mexico_City'
      },
      localization: {
        currency: settings.currency || 'MXN',
        country: 'MX'
      },
      documents: {
        default_template: null
      }
    };

    return NextResponse.json(config);
  } catch (e) {
    // Safe fallback so app never breaks on config
    return NextResponse.json({
      version: Date.now(),
      company: { name: 'TECAVO FRUITS', slogan: 'Del campo con amor' },
      branding: { primary_color: '#1F6B3A' },
      theme: {},
      navigation: [],
      operational_rules: { price_source: 'price_weeks' }
    });
  }
}
