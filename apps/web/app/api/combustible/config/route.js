import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT config_key, config_value FROM combustible_configuracion`;
    const config = {};
    rows.forEach(r => { config[r.config_key] = r.config_value; });
    // defaults per spec - full corporate + print options
    return NextResponse.json({
      company_name: config.company_name || 'Tecavo Fruits',
      module_name: config.module_name || 'CONTROL DE COMBUSTIBLE',
      slogan: config.slogan || 'Trazabilidad completa de cargas de combustible',
      razon_social: config.razon_social || 'Comercializadora de Frutas de Tacámbaro, S.A. de C.V.',
      eslogan: config.eslogan || config.slogan || 'Del campo con amor',
      ubicacion: config.ubicacion || 'Tacámbaro, Michoacán, México',
      correo: config.correo || config.email || 'jorge.perezvelez@tecavofruits.com',
      telefono: config.telefono || config.whatsapp || '459 104 55 66',
      logo_url: config.logo_url || '',
      primary_color: config.primary_color || '#0B4F2B',
      secondary_color: config.secondary_color || '#17653C',
      accent_color: config.accent_color || '#E9E45A',
      terracota: config.terracota || '#A73D20',
      bg_color: config.bg_color || '#F4F7F4',
      text_color: config.text_color || '#173126',
      border_color: config.border_color || '#DBE5DE',
      warning_bg: config.warning_bg || '#FFF4CF',
      error_bg: config.error_bg || '#FFE0DC',
      success_bg: config.success_bg || '#E1F4E7',
      font_family: config.font_family || 'Inter, Segoe UI, Arial, sans-serif',
      // Print template settings
      print_show_qr: config.print_show_qr !== 'false',
      print_show_firmas: config.print_show_firmas !== 'false',
      print_show_relaciones: config.print_show_relaciones !== 'false',
      print_show_centro_costo: config.print_show_centro_costo === 'true',
      print_show_fecha_impresion: config.print_show_fecha_impresion !== 'false',
      print_show_usuario: config.print_show_usuario !== 'false'
    });
  } catch (e) {
    return NextResponse.json({
      company_name: 'Tecavo Fruits',
      module_name: 'CONTROL DE COMBUSTIBLE',
      slogan: 'Trazabilidad completa de cargas de combustible',
      logo_url: '',
      primary_color: '#0B4F2B',
      secondary_color: '#17653C',
      accent_color: '#E9E45A',
      terracota: '#A73D20',
      bg_color: '#F4F7F4',
      text_color: '#173126',
      border_color: '#DBE5DE',
      warning_bg: '#FFF4CF',
      error_bg: '#FFE0DC',
      success_bg: '#E1F4E7',
      font_family: 'Inter, Segoe UI, Arial, sans-serif'
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const user = 'admin';
    const keys = Object.keys(body);
    for (const k of keys) {
      const v = body[k];
      await sql`
        INSERT INTO combustible_configuracion (config_key, config_value, updated_by, updated_at)
        VALUES (${k}, ${String(v || '')}, ${user}, CURRENT_TIMESTAMP)
        ON CONFLICT (config_key) DO UPDATE SET config_value = ${String(v || '')}, updated_by = ${user}, updated_at = CURRENT_TIMESTAMP
      `;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error guardando configuración' }, { status: 500 });
  }
}
