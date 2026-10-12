import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: Fetch latest fruit field price data from DB for Canva integration
export async function GET() {
  try {
    // Get most recent active published prices or latest entry
    let prices = await sql`
      SELECT * FROM precios_fruta_publicados 
      WHERE activo = true 
      ORDER BY fecha_publicacion DESC 
      LIMIT 1
    `;
    if (!prices.length) {
      prices = await sql`
        SELECT * FROM precios_fruta_publicados 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
    }
    const p = prices[0] || {};
    
    const priceData = {
      semana: p.semana || 1,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      super_extra: p.super_extra || 0,
      extra: p.extra || 0,
      primera: p.primera || 0,
      mediano: p.mediano || 0,
      tercera: p.tercera || 0,
      cuarta: p.cuarta || 0,
      proceso: p.proceso || 0,
      canica: p.canica || 0,
      desecho: p.desecho || 0,
      responsable: p.responsable || '',
      telefono_1: p.telefono_1 || '',
      telefono_2: p.telefono_2 || '',
      direccion: p.direccion || '',
      transporte_subtotal: p.transporte_subtotal || p.costo_transporte || 3.98,
      seguros_tramites: p.seguro_subtotal || p.costo_seguro || 0.44,
      total_costos_kg: p.total_costos || p.sum_costos || 12.44,
    };
    return NextResponse.json({ success: true, prices: priceData });
  } catch (e) {
    console.error('Error loading Canva prices:', e);
    return NextResponse.json({ error: 'Failed to load prices' }, { status: 500 });
  }
}

// POST: Generate image via Canva API using current prices + provided token/template and returns exported image url
// All text and number renders are forced black: uses official autofill where available
export async function POST(request) {
  try {
    const body = await request.json();
    const accessToken = body.accessToken || '';
    const templateId = body.templateId || body.brand_template_id || '';
    const extraTitle = body.title || '';

    if (!accessToken || !templateId) {
      return NextResponse.json({ 
        error: 'accessToken and templateId (brand_template_id) are required for Canva.',
        hint: 'Create a Canva app at canva.com/developers to get OAuth access token and choose a brand template.'
      }, { status: 400 });
    }

    // 1. Load price data directly from DB
    let pricesRes = await sql`
      SELECT * FROM precios_fruta_publicados 
      WHERE activo = true 
      ORDER BY fecha_publicacion DESC 
      LIMIT 1
    `;
    if (!pricesRes.length) {
      pricesRes = await sql`SELECT * FROM precios_fruta_publicados ORDER BY created_at DESC LIMIT 1`;
    }
    const p = pricesRes[0] || {};
    const week = p.semana || 'N/A';
    const title = extraTitle || `LISTA PRECIOS FRUTA CAMPO SEMANA ${week}`;

    // Prepare AUTOFILL data with black text emphasis built in template recommendation
    // All prices/numbers supplied as plain text. User should set text color = pure BLACK (hex #000000) in Canva template for all text/numbers elements.
    const dataFields = {
      title: { type: 'text', value: title },
      semana: { type: 'text', value: `Semana ${week}` },
      super_extra: { type: 'text', value: `${p.super_extra || 0}` },
      extra: { type: 'text', value: `${p.extra || 0}` },
      primera: { type: 'text', value: `${p.primera || 0}` },
      mediano: { type: 'text', value: `${p.mediano || 0}` },
      tercera: { type: 'text', value: `${p.tercera || 0}` },
      cuarta: { type: 'text', value: `${p.cuarta || 0}` },
      proceso: { type: 'text', value: `${p.proceso || 0}` },
      canica: { type: 'text', value: `${p.canica || 0}` },
      desecho: { type: 'text', value: `${p.desecho || 0}` },
      responsable: { type: 'text', value: p.responsable || 'Tecavo Fruits' },
      contacto: { type: 'text', value: (p.telefono_1 || '') },
      direccion: { type: 'text', value: p.direccion || '' },
      // Transport & insurance for Canva price list template autofill (use BLACK text fill)
      flete_terrestre: { type: 'text', value: '3.54' },
      seguro_tramite: { type: 'text', value: '0.44' },
      costo_transporte_total: { type: 'text', value: '3.98' },
      total_costos_por_kg: { type: 'text', value: `${Number(p.total_costos || 12.44).toFixed(2)}` }
    };

    // Preferred: Use proper Autofill to inject prices and texts (Enterprise may be needed)
    const autofillRes = await fetch('https://api.canva.com/rest/v1/autofills', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brand_template_id: templateId,
        data: dataFields
      })
    });

    let designId = null;
    let designUrl = null;

    if (autofillRes.ok) {
      const job = await autofillRes.json();
      const autofillJobId = job?.id || job?.job?.id || job?.autofill?.id;

      // Poll job for completion to retrieve design
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1200));
        const s = await fetch(`https://api.canva.com/rest/v1/autofills/${autofillJobId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (s.ok) {
          const statusJson = await s.json();
          const status = statusJson?.autofill?.status || statusJson?.status;
          if (status === 'success' || status === 'succeeded') {
            designId = statusJson?.design?.id || statusJson?.autofill?.design?.id || statusJson?.design_id;
            designUrl = statusJson?.design?.urls?.edit_url || `https://www.canva.com/design/${designId}`;
            break;
          }
          if (status === 'failed') break;
        }
      }
    }

    // Fallback for non-auto -- try plain /designs (may not inject fields)
    if (!designId) {
      const createRes = await fetch('https://api.canva.com/rest/v1/designs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, brand_template_id: templateId })
      });
      if (createRes.ok) {
        const c = await createRes.json();
        designId = c?.design?.id || c?.id;
      }
    }

    if (!designId) {
      return NextResponse.json({ error: 'Could not create design with Canva (check token + enterprise access for autofill).', price_data: dataFields }, { status: 400 });
    }

    // Force export to PNG
    const exportRes = await fetch('https://api.canva.com/rest/v1/exports', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ design_id: designId, format: { type: 'png' } })
    });

    if (!exportRes.ok) {
      const txt = await exportRes.text().catch(()=> '');
      return NextResponse.json({ error: `Export failed: ${exportRes.status} ${txt}`, design_id: designId, design_url: designUrl || `https://www.canva.com/design/${designId}` });
    }

    const expData = await exportRes.json();
    const jobId = expData?.job?.id || expData?.id;

    let exportUrl = null;
    for (let i=0; i<18; i++) {
      await new Promise(r => setTimeout(r, 1300));
      const ch = await fetch(`https://api.canva.com/rest/v1/exports/${jobId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (ch.ok) {
        const js = await ch.json();
        const st = js?.export?.status || js?.status;
        if (st === 'succeeded' || st === 'success') {
          exportUrl = js?.export?.url || js?.url;
          break;
        }
        if (st === 'failed') break;
      }
    }

    if (!exportUrl) {
      return NextResponse.json({ 
        success: true,
        message: 'Diseño Canva creado. Export timeout: abre en Canva (la plantilla debe tener todos los textos configurados en NEGRO).',
        design_id: designId,
        design_url: designUrl || `https://www.canva.com/design/${designId}`,
        price_data: dataFields
      });
    }

    return NextResponse.json({ success: true, image_url: exportUrl, design_id: designId, price_data: dataFields });
  } catch (err) {
    console.error('Canva generate error', err);
    return NextResponse.json({ error: err.message || 'Error generando imagen con Canva.' }, { status: 500 });
  }
}
