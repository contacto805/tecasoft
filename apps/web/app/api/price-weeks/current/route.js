import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0,10);

    // Find latest PUBLISHED week that covers the date
    const rows = await sql`
      SELECT * FROM price_weeks 
      WHERE status = 'PUBLICADO' 
        AND (date_from IS NULL OR date_from <= ${date})
        AND (date_to IS NULL OR date_to >= ${date})
      ORDER BY published_at DESC, week_year DESC, week_number DESC 
      LIMIT 1
    `;
    if (!rows.length) {
      // fallback latest published
      const fb = await sql`SELECT * FROM price_weeks WHERE status='PUBLICADO' ORDER BY published_at DESC LIMIT 1`;
      if (!fb.length) return NextResponse.json({ week: null, items: [] });
      const items = await sql`SELECT * FROM price_week_items WHERE price_week_id = ${fb[0].id}`;
      return NextResponse.json({ week: fb[0], items });
    }
    const items = await sql`SELECT * FROM price_week_items WHERE price_week_id = ${rows[0].id}`;
    return NextResponse.json({ week: rows[0], items });
  } catch (e) {
    return NextResponse.json({ week: null, items: [], error: e.message });
  }
}
