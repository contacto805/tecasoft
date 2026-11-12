import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Central ascending folio controller linked to Administración
// All modules that generate tickets, notas, docs, etc. should call this for control
// Supports prefix param e.g. ?prefix=DOC- or ?type=nota

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = (searchParams.get('prefix') || searchParams.get('type') || 'DOC-').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,10) || 'DOC-';
    
    // Use a simple global counter table if exists, else derive from max in common tables + local sequence
    // For simplicity and to avoid heavy joins on every call, we store last per prefix in app-config like key
    const key = `central_folio_${prefix.replace(/[^A-Z0-9]/g,'')}`;

    // Try to read last from a lightweight store (system_settings or config)
    let last = 0;
    try {
      const rows = await sql`SELECT value FROM system_settings WHERE key = ${key} LIMIT 1`;
      if (rows.length && rows[0].value) {
        const n = parseInt(String(rows[0].value).replace(prefix,'')) || 0;
        last = n;
      }
    } catch (_) {}

    if (!last) {
      // Fallback: scan a few common document tables for max numeric part (safe, read only)
      try {
        const candidates = await sql`
          SELECT folio FROM (
            SELECT folio FROM abonos WHERE folio LIKE ${prefix + '%'}
            UNION ALL SELECT folio FROM notas WHERE folio LIKE ${prefix + '%'}
            UNION ALL SELECT folio FROM payment_schedule WHERE folio LIKE ${prefix + '%'}
            UNION ALL SELECT folio FROM operating_costs WHERE folio LIKE ${prefix + '%'}
            UNION ALL SELECT sales_folio as folio FROM sales_of_process_and_waste WHERE sales_folio LIKE ${prefix + '%'}
            LIMIT 50
          ) t ORDER BY folio DESC LIMIT 1
        `;
        if (candidates.length) {
          const m = String(candidates[0].folio || '').match(/(\d+)$/);
          last = m ? parseInt(m[1],10) : 0;
        }
      } catch(_) {}
    }

    const nextNum = last + 1;
    const nextFolio = prefix + String(nextNum).padStart(4, '0');

    // Persist the new last (best effort)
    try {
      await sql`
        INSERT INTO system_settings (key, value, created_at)
        VALUES (${key}, ${nextFolio}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${nextFolio}
      `;
    } catch (_) {
      // ignore if table not perfect match; folio still returned
    }

    return NextResponse.json({ nextFolio, prefix, linked_to: 'administracion', note: 'Usar este folio en tickets/notas para control central' });
  } catch (e) {
    // Always return a safe default so modules never break
    const prefix = (new URL(request.url).searchParams.get('prefix') || 'DOC-');
    const safe = prefix + '0001';
    return NextResponse.json({ nextFolio: safe, prefix, fallback: true });
  }
}
