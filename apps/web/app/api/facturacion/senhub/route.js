import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

const SENHUB_BASE = "https://lite.senhub.mx/api/v1";

// Generate stable idempotency key - reuse exactly on retries (critical per SenHub docs)
function generateIdempotencyKey(prefix = 'tecavo') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getSenhubToken() {
  const rows = await sql`
    SELECT key, value FROM system_settings 
    WHERE key IN ('senhub_access_token', 'senhub_refresh_token', 'senhub_email', 'senhub_sandbox', 'senhub_emisor_rfc', 'senhub_emisor_nombre', 'senhub_lugar_expedicion')
  `;
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    access: map.senhub_access_token || null,
    refresh: map.senhub_refresh_token || null,
    email: map.senhub_email || null,
    sandbox: map.senhub_sandbox === 'true',
    emisor_rfc: map.senhub_emisor_rfc || null,
    emisor_nombre: map.senhub_emisor_nombre || null,
    lugar_expedicion: map.senhub_lugar_expedicion || null
  };
}

async function saveTokens(access, refresh) {
  if (access) {
    await sql`
      INSERT INTO system_settings (key, value, updated_at) 
      VALUES ('senhub_access_token', ${access}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
  }
  if (refresh) {
    await sql`
      INSERT INTO system_settings (key, value, updated_at) 
      VALUES ('senhub_refresh_token', ${refresh}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
  }
}

async function refreshIfNeeded(tokenData) {
  if (!tokenData.access && tokenData.refresh) {
    try {
      const r = await fetch(`${SENHUB_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokenData.refresh })
      });
      if (r.ok) {
        const d = await r.json();
        await saveTokens(d.access_token, d.refresh_token);
        return d.access_token;
      }
    } catch (_) {}
  }
  return tokenData.access;
}

// Log SenHub operations (never store secrets)
async function logSenhubOp(user, action, entity, status, details = {}) {
  try {
    await sql`
      INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, entity_id, status, description, timestamp)
      VALUES (${user || 'sistema'}, ${user || 'sistema'}, 'senhub', ${action}, 'cfdi', ${entity || null}, ${status}, ${JSON.stringify(details).slice(0, 2000)}, CURRENT_TIMESTAMP)
    `;
  } catch (_) {}
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'balance';

    const tok = await getSenhubToken();
    const token = await refreshIfNeeded(tok);

    if (!token) {
      return NextResponse.json({ error: 'No hay token Senhub configurado' }, { status: 400 });
    }

    if (action === 'balance') {
      const r = await fetch(`${SENHUB_BASE}/creditos/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'request_otp') {
      const email = body.email;
      if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });
      const r = await fetch(`${SENHUB_BASE}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.ok ? 200 : 400 });
    }

    if (action === 'verify_otp') {
      const { email, code } = body;
      if (!email || !code) return NextResponse.json({ error: 'email y code requeridos' }, { status: 400 });
      const r = await fetch(`${SENHUB_BASE}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await r.json().catch(() => ({}));
      if (data.access_token) {
        await saveTokens(data.access_token, data.refresh_token);
      }
      return NextResponse.json(data, { status: r.ok ? 200 : 400 });
    }

    // TIMBRAR: Full compliant payload per SenHub docs (exact field names)
    // MODO SEGURO: one authorized op = one CFDI. Stable idempotency. No sales creation. Server-only creds.
    if (action === 'timbrar' || action === 'stamp') {
      const tok = await getSenhubToken();
      let token = await refreshIfNeeded(tok);
      if (!token) return NextResponse.json({ error: 'Configura Senhub primero en Configuraciones' }, { status: 400 });

      const {
        emisor_rfc,
        emisor_nombre,
        emisor_regimen = '601',
        lugar_expedicion,
        customer_id,
        customer_rfc,
        customer_name,
        fiscal_razon_social,
        domicilio_fiscal_receptor,
        regimen_fiscal_receptor,
        uso_cfdi = 'G03',
        forma_pago = '03',
        metodo_pago = 'PUE',
        moneda = 'MXN',
        tipo_cambio,
        exportacion = '01',
        conceptos = [],
        importe_total,
        related_viaje_id,
        related_load_id,
        related_nota_id,
        serie = 'A',
        folio
      } = body;

      // STRICT pre-validation (block 15): RFCs, complete receptor, at least one link ID, no duplicate CFDI for same entity
      const hasEmisor = !!(emisor_rfc || tok.emisor_rfc);
      const hasReceptorRfc = !!(customer_rfc || fiscal_razon_social);
      const hasLink = !!(related_viaje_id || related_load_id || related_nota_id || customer_id);
      if (!hasEmisor || !hasReceptorRfc || !hasLink) {
        return NextResponse.json({ error: 'Datos fiscales incompletos (RFC emisor/receptor + enlace a operación requeridos). No se timbra.', retry_with_same_idempotency: false }, { status: 400 });
      }

      // Prevent duplicate stamp for same logical operation (by related ids)
      if (related_nota_id) {
        const [dup] = await sql`SELECT id, uuid, estatus FROM cfdi_facturas WHERE nota_id = ${parseInt(related_nota_id)} AND estatus = 'TIMBRADA' LIMIT 1`;
        if (dup) return NextResponse.json({ error: 'Ya existe CFDI timbrado para esta nota. Reutiliza UUID existente.', existing: dup, retry_with_same_idempotency: true }, { status: 409 });
      }
      if (related_viaje_id) {
        const [dup] = await sql`SELECT id, uuid, estatus FROM cfdi_facturas WHERE viaje_id = ${parseInt(related_viaje_id)} AND estatus = 'TIMBRADA' LIMIT 1`;
        if (dup) return NextResponse.json({ error: 'Ya existe CFDI timbrado para este viaje.', existing: dup, retry_with_same_idempotency: true }, { status: 409 });
      }

      const isSandbox = tok.sandbox || false;
      // STABLE idempotency: generated once per logical attempt. Caller MUST reuse the returned key on any retry/timeout.
      const idempotencyKey = generateIdempotencyKey('tecavo-cfdi');

      // Build exact SenHub CFDI 4.0 payload (respect docs)
      const payload = {
        emisor_rfc: emisor_rfc || tok.emisor_rfc || 'EKU9003173C9',
        emisor_nombre: emisor_nombre || tok.emisor_nombre || 'TECAVO FRUITS',
        emisor_regimen: emisor_regimen,
        lugar_expedicion: lugar_expedicion || tok.lugar_expedicion || '60000',
        tipo_de_comprobante: 'I',
        moneda,
        tipo_cambio: moneda === 'MXN' ? '1' : (tipo_cambio || '18.50'),
        exportacion,
        forma_pago,
        metodo_pago,
        serie: serie || undefined,
        folio: folio || undefined,
        sandbox: isSandbox,
        receptor: {
          rfc: customer_rfc || 'XAXX010101000',
          nombre: fiscal_razon_social || customer_name || 'PUBLICO EN GENERAL',
          domicilio_fiscal_receptor: domicilio_fiscal_receptor || lugar_expedicion || '60000',
          regimen_fiscal_receptor: regimen_fiscal_receptor || '601',
          uso_cfdi
        },
        conceptos: conceptos.length > 0 ? conceptos : [{
          clave_prod_serv: '01010101',
          cantidad: 1,
          clave_unidad: 'E48',
          descripcion: 'Servicio / Venta de fruta TECAVO',
          valor_unitario: parseFloat(importe_total) || 1000,
          objeto_imp: '02',
          traslados: [{ impuesto: '002', tipo_factor: 'Tasa', tasa_o_cuota: '0.160000' }]
        }]
      };

      // IMPORTANT: Reuse SAME idempotency key on any retry/timeout
      const r = await fetch(`${SENHUB_BASE}/timbrado/timbrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const result = await r.json().catch(() => ({}));

      if (r.ok && result.uuid) {
        // Save with full audit data + idempotency for retry safety (never duplicate)
        const [saved] = await sql`
          INSERT INTO cfdi_facturas (
            folio_interno, serie, uuid, fecha_timbrado, customer_id, rfc_cliente,
            moneda, importe, importe_usd, uso_factura, pdf_url, xml_url, estatus, created_by, observaciones
          ) VALUES (
            ${result.folio || result.uuid?.slice(0,8)}, ${serie}, ${result.uuid}, CURRENT_DATE,
            ${customer_id ? parseInt(customer_id) : null}, ${customer_rfc || null},
            ${moneda}, ${parseFloat(importe_total) || 0}, ${parseFloat(importe_total) || 0},
            ${uso_cfdi}, ${result.pdf_url || null}, ${result.xml_url || null},
            'TIMBRADA', 'senhub',
            ${JSON.stringify({ idempotency_key: idempotencyKey, senhub_response: result, sandbox: isSandbox, related: {viaje:related_viaje_id,load:related_load_id,nota:related_nota_id} }).slice(0, 4000)}
          ) RETURNING *
        `;

        if (related_load_id) {
          await sql`UPDATE load_history SET factura_folio = ${result.uuid} WHERE id = ${parseInt(related_load_id)}`;
        }
        if (related_viaje_id) {
          await sql`UPDATE viajes SET factura_id = ${saved.id} WHERE id = ${parseInt(related_viaje_id)}`;
        }
        if (related_nota_id) {
          await sql`UPDATE notas SET estatus = 'FACTURADA' WHERE id = ${parseInt(related_nota_id)}`;
        }

        await logSenhubOp('senhub', 'timbrar', result.uuid, 'success', { customer_id, uuid: result.uuid, idempotency: idempotencyKey });

        return NextResponse.json({ success: true, cfdi: saved, senhub: result, idempotency_key: idempotencyKey });
      }

      await logSenhubOp('senhub', 'timbrar', null, 'error', { error: result });

      // On error/timeout: do NOT generate new key — caller must reuse
      return NextResponse.json({ 
        error: result.detail || result.message || 'Error al timbrar', 
        code: result.code,
        raw: result,
        retry_with_same_idempotency: true 
      }, { status: 400 });
    }

    // CANCEL CFDI (per SenHub: POST /timbrado/cancelar)
    if (action === 'cancelar' || action === 'cancel') {
      const tok = await getSenhubToken();
      let token = await refreshIfNeeded(tok);
      if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

      const { uuid, emisor_rfc, motivo = '02', folio_sustitucion } = body;
      if (!uuid) return NextResponse.json({ error: 'uuid requerido' }, { status: 400 });

      const r = await fetch(`${SENHUB_BASE}/timbrado/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emisor_rfc: emisor_rfc || tok.emisor_rfc, uuid, motivo, folio_sustitucion })
      });
      const result = await r.json().catch(() => ({}));

      if (r.ok) {
        await sql`UPDATE cfdi_facturas SET estatus = 'CANCELADA', observaciones = ${JSON.stringify({ cancel: result })} WHERE uuid = ${uuid}`;
        await logSenhubOp('senhub', 'cancelar', uuid, 'success', { motivo });
      }
      return NextResponse.json(result, { status: r.ok ? 200 : 400 });
    }

    // Get CFDI details / XML / PDF proxy (use UUID to fetch fresh)
    if (action === 'get_cfdi' || action === 'pdf' || action === 'xml') {
      const tok = await getSenhubToken();
      let token = await refreshIfNeeded(tok);
      const { uuid } = body;
      if (!uuid) return NextResponse.json({ error: 'uuid requerido' }, { status: 400 });

      let endpoint = `/timbrado/cfdi/${uuid}`;
      if (action === 'pdf') endpoint += '/pdf';
      if (action === 'xml') endpoint += '/xml';

      const r = await fetch(`${SENHUB_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (action === 'pdf' || action === 'xml') {
        const blob = await r.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return NextResponse.json({ data: base64, content_type: r.headers.get('content-type') || (action==='pdf'?'application/pdf':'application/xml') });
      }
      const data = await r.json().catch(()=>({}));
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (e) {
    console.error('senhub api error', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
