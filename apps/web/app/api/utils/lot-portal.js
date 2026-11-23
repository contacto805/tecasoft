import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";

export const newLotToken = () => crypto.randomBytes(16).toString("hex");
export const validLotToken = token => /^[a-f0-9]{32}$/i.test(token || "");

export async function ensureLotLink(lotId) {
  // Serialize reprints by locking the parent. An existing link remains stable.
  const [link] = await sql`
    WITH locked AS (
      SELECT id FROM lots WHERE id = ${lotId} FOR UPDATE
    ), candidates AS (
      SELECT p.lot_id, p.public_token, p.is_active
      FROM public_lot_links p JOIN locked ON locked.id = p.lot_id
      ORDER BY p.is_active DESC NULLS LAST, p.id
      LIMIT 1
    ), created AS (
      INSERT INTO lot_dashboard_info (lot_id, public_token, is_active, created_at)
      SELECT id, COALESCE((SELECT public_token FROM candidates), ${newLotToken()}),
             COALESCE((SELECT is_active FROM candidates), true), NOW()
      FROM locked
      ON CONFLICT (lot_id) DO UPDATE SET lot_id = EXCLUDED.lot_id
      RETURNING lot_id, public_token, is_active
    )
    SELECT * FROM created
  `;
  return link;
}

export async function getPublicLot(token) {
  if (!validLotToken(token)) return null;
  const [lot] = await sql`
    WITH matches AS (
      SELECT lot_id FROM public_lot_links WHERE public_token = ${token} AND is_active = true
      UNION
      SELECT lot_id FROM lot_dashboard_info WHERE public_token = ${token} AND is_active = true
    )
    SELECT l.id AS lot_id, l.lot_number, l.fruit_type, l.producer,
           l.orchard_name, l.origin, l.municipality, l.date,
           COALESCE(l.total_kg_received, (SELECT SUM(w.net_weight) FROM weighings w WHERE w.lot_id = l.id)) AS total_kg_received,
           to_jsonb(l)->>'total_kg_packed' AS total_kg_packed, l.status,
           to_jsonb(dt)->>'dashboard_image_url' AS dashboard_image_url,
           to_jsonb(dt)->>'template_image_url' AS template_image_url,
           COALESCE((SELECT p.public_token FROM public_lot_links p
             WHERE p.lot_id = l.id AND p.is_active = true AND p.public_token = d.public_token LIMIT 1),
             (SELECT p.public_token FROM public_lot_links p
             WHERE p.lot_id = l.id AND p.is_active = true ORDER BY p.id LIMIT 1),
             d.public_token, ${token}) AS public_token
    FROM matches m JOIN lots l ON l.id = m.lot_id
    LEFT JOIN lot_dashboard_info d ON d.lot_id = l.id
    LEFT JOIN dashboard_templates dt ON dt.id = d.template_id
    WHERE d.is_active IS DISTINCT FROM false
      AND (SELECT count(*) FROM matches) = 1
      AND NOT EXISTS (
        SELECT 1 FROM public_lot_links revoked WHERE revoked.public_token = ${token}
          AND revoked.is_active = false
      )
  `;
  return lot || null;
}

export async function getLotPresentation(lot) {
  const [config] = await sql`
    SELECT to_jsonb(c) AS options FROM public_dashboard_config c
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1
  `;
  const options = config?.options || {};
  const visibleLot = { ...lot };
  const styleFields = [
    "primary_color", "secondary_color", "accent_color", "text_color", "background_color",
    "card_background_color", "header_background_color", "footer_background_color",
    "border_color", "button_color", "font_family", "font_size_title", "font_size_body",
    "font_size_small", "logo_url", "show_origin_data", "show_production_data",
    "show_commercial_data", "show_producer", "show_orchard", "show_location",
    "show_harvest_date", "show_variety", "show_weight"
  ];
  const fields = {
    producer: ["show_origin_data", "show_producer"],
    orchard_name: ["show_origin_data", "show_orchard"],
    origin: ["show_origin_data", "show_location"],
    municipality: ["show_origin_data", "show_location"],
    date: ["show_origin_data", "show_harvest_date"],
    fruit_type: ["show_production_data", "show_variety"],
    total_kg_received: ["show_production_data", "show_weight"],
    total_kg_packed: ["show_production_data", "show_weight"],
  };
  for (const [field, flags] of Object.entries(fields)) {
    if (flags.some(flag => options[flag] === false)) delete visibleLot[field];
  }
  return {
    lot: visibleLot,
    config: {
      ...Object.fromEntries(styleFields.map(field => [field, options[field]])),
      company_name: options.company_name,
      header_image_url: options.header_image_url,
      template_image_url: options.template_image_url,
      header_text: options.header_text,
      footer_text: options.footer_text,
      commercial_message: options.show_commercial_data === false ? null : options.commercial_message,
      product_image_url: options.product_image_url,
      certification_images: options.certification_images,
      gallery_images: options.gallery_images,
    }
  };
}

export async function recordLotScan(request, lot, token) {
  try {
    await sql`
      INSERT INTO public_qr_access_log (lot_id, public_token, ip_address, user_agent, device_type, access_timestamp)
      VALUES (${lot.lot_id}, ${token}, ${request.headers.get('x-forwarded-for') || 'unknown'},
              ${request.headers.get('user-agent') || 'unknown'},
              ${/tablet|ipad/i.test(request.headers.get('user-agent') || '') ? 'tablet' :
                /mobile/i.test(request.headers.get('user-agent') || '') ? 'mobile' : 'desktop'}, NOW())
    `;
  } catch (error) {
    console.error("No se pudo registrar el acceso al lote", error.message);
  }
}
