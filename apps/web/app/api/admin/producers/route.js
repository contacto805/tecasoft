import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { generateProducerPIN, sendProducerPINToWhatsApp } from "@/app/api/utils/customer-portal-auth";

// Helper: check if user has full visibility (Super or Admin General)
async function hasFullProducerVisibility(request) {
  try {
    const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/user`, { 
      headers: { cookie: request.headers.get('cookie') || '' } 
    });
    if (!userRes.ok) return false;
    const u = await userRes.json().catch(() => ({}));
    const isSuper = !!u.is_super_admin || u.admin_role === 'superadministrador';
    const isAdminGen = (u.admin_role || '').toLowerCase().includes('administracion') || (u.admin_role || '').toLowerCase().includes('general');
    return isSuper || isAdminGen;
  } catch {
    return false;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const byNumber = searchParams.get('number') || '';
  const byName = searchParams.get('name') || '';
  const byRfc = searchParams.get('rfc') || '';
  const byPhone = searchParams.get('phone') || '';

  const canSeeAll = await hasFullProducerVisibility(request);
  if (!canSeeAll) {
    return NextResponse.json({ error: 'No autorizado para ver todos los productores' }, { status: 403 });
  }

  try {
    let where = sql``;
    const conditions = [];

    if (byNumber) conditions.push(sql`producer_number ILIKE ${'%' + byNumber + '%'}`);
    if (byName) conditions.push(sql`producer_name ILIKE ${'%' + byName + '%'}`);
    if (byRfc) conditions.push(sql`rfc ILIKE ${'%' + byRfc + '%'}`);
    if (byPhone) conditions.push(sql`whatsapp_phone ILIKE ${'%' + byPhone + '%'}`);
    if (q) {
      conditions.push(sql`(producer_number ILIKE ${'%'+q+'%'} OR producer_name ILIKE ${'%'+q+'%'} OR rfc ILIKE ${'%'+q+'%'} OR whatsapp_phone ILIKE ${'%'+q+'%'})`);
    }

    if (conditions.length) {
      where = sql`WHERE ${conditions.reduce((a, b, i) => i === 0 ? b : sql`${a} AND ${b}`)}`;
    }

    const rows = await sql`
      SELECT id, producer_number, producer_name, whatsapp_phone, rfc, is_enabled, failed_attempts, last_login_at, pin_updated_at, created_at
      FROM producer_portal_access
      ${where}
      ORDER BY COALESCE(producer_number, producer_name) ASC
      LIMIT 100
    `;

    // Also surface unique producers from data if no portal entry (for assignment)
    const rawProducers = await sql`
      SELECT DISTINCT producer_name as name FROM lots WHERE producer_name IS NOT NULL AND producer_name <> ''
      UNION
      SELECT DISTINCT producer_name as name FROM cutting_orders WHERE producer_name IS NOT NULL AND producer_name <> ''
      UNION
      SELECT DISTINCT producer_name as name FROM payment_schedule WHERE producer_name IS NOT NULL AND producer_name <> ''
      LIMIT 50
    `;

    return NextResponse.json({ 
      producers: rows, 
      rawNames: rawProducers.map(r => r.name).filter(Boolean),
      canSeeAll: true 
    });
  } catch (e) {
    return NextResponse.json({ producers: [], rawNames: [], error: 'Error consultando' }, { status: 200 });
  }
}

export async function POST(request) {
  const canSeeAll = await hasFullProducerVisibility(request);
  if (!canSeeAll) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, producerName, producerNumber, whatsappPhone, rfc, pinAction } = body || {};

    if (action === 'assign-number' || action === 'register') {
      if (!producerName) return NextResponse.json({ error: 'Nombre de productor requerido' }, { status: 400 });
      const num = (producerNumber || '').trim() || ('PROD-' + String(Date.now()).slice(-6));
      // Upsert portal record
      const ex = await sql`SELECT id FROM producer_portal_access WHERE producer_name = ${producerName} OR producer_number = ${num} LIMIT 1`;
      if (ex.length) {
        await sql`UPDATE producer_portal_access SET producer_number=${num}, whatsapp_phone=COALESCE(${whatsappPhone}, whatsapp_phone), rfc=COALESCE(${rfc}, rfc), updated_at=NOW() WHERE id=${ex[0].id}`;
      } else {
        await sql`INSERT INTO producer_portal_access (producer_number, producer_name, whatsapp_phone, rfc, is_enabled) VALUES (${num}, ${producerName}, ${whatsappPhone || null}, ${rfc || null}, true)`;
      }
      return NextResponse.json({ success: true, producerNumber: num });
    }

    if (action === 'generate-pin') {
      const ident = producerNumber || producerName;
      if (!ident) return NextResponse.json({ error: 'Identificador requerido' }, { status: 400 });
      const plain = await generateProducerPIN(producerName || ident, producerNumber || null, whatsappPhone || null);
      // Attempt send
      const phone = whatsappPhone;
      const sendRes = await sendProducerPINToWhatsApp(ident, phone, plain);
      return NextResponse.json({ success: true, pin: plain, whatsappSent: sendRes.sent, whatsappInfo: sendRes });
    }

    if (action === 'regenerate-pin') {
      const ident = producerNumber || producerName;
      if (!ident) return NextResponse.json({ error: 'Identificador requerido' }, { status: 400 });
      const plain = await generateProducerPIN(producerName || ident, producerNumber || null, whatsappPhone || null);
      const sendRes = await sendProducerPINToWhatsApp(ident, whatsappPhone, plain);
      return NextResponse.json({ success: true, pin: plain, whatsappSent: sendRes.sent });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Error procesando' }, { status: 500 });
  }
}