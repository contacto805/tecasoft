import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const year = searchParams.get("year");
    const week = searchParams.get("week");
    const market = searchParams.get("market");
    const current = searchParams.get("current") === "true";

    if (id) {
      const [weekData] = await sql`
        SELECT * FROM price_weeks WHERE id = ${parseInt(id)}
      `;
      if (!weekData) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

      const items = await sql`
        SELECT pwi.*, cd.display_name, cd.caliber_name 
        FROM price_week_items pwi
        LEFT JOIN caliber_definitions cd ON cd.caliber_code = pwi.caliber_code
        WHERE pwi.price_week_id = ${parseInt(id)}
        ORDER BY pwi.id ASC
      `;
      return NextResponse.json({ ...weekData, items });
    }

    let q = sql`SELECT * FROM price_weeks WHERE 1=1 `;
    if (status) q = sql`${q} AND status = ${status}`;
    if (year) q = sql`${q} AND week_year = ${parseInt(year)}`;
    if (week) q = sql`${q} AND week_number = ${parseInt(week)}`;
    if (market) q = sql`${q} AND market = ${market}`;
    if (current) q = sql`${q} AND status = 'PUBLICADO'`;
    
    q = sql`${q} ORDER BY week_year DESC, week_number DESC, version DESC LIMIT 100`;
    const weeks = await q;

    // attach items count and basic
    const withCounts = await Promise.all(weeks.map(async (w) => {
      const [cnt] = await sql`SELECT COUNT(*) as c FROM price_week_items WHERE price_week_id=${w.id}`;
      return { ...w, items_count: parseInt(cnt?.c || 0) };
    }));

    return NextResponse.json(withCounts);
  } catch (e) {
    console.error("price-weeks GET", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === "duplicate") {
      const { source_week_id } = body;
      if (!source_week_id) return NextResponse.json({ error: "source_week_id requerido" }, { status: 400 });

      const [src] = await sql`SELECT * FROM price_weeks WHERE id=${parseInt(source_week_id)}`;
      if (!src) return NextResponse.json({ error: "Semana origen no encontrada" }, { status: 404 });

      let nextWeek = src.week_number + 1;
      let nextYear = src.week_year;
      if (nextWeek > 53) { nextWeek = 1; nextYear += 1; }

      const [newWeek] = await sql`
        INSERT INTO price_weeks (week_year, week_number, date_from, date_to, market, exchange_rate_mxn_usd, status, version, notes, created_by)
        VALUES (${nextYear}, ${nextWeek}, ${src.date_from}, ${src.date_to}, ${src.market}, ${src.exchange_rate_mxn_usd}, 'BORRADOR', 1, ${'Duplicado de semana ' + src.week_number}, 'superadmin')
        RETURNING *
      `;

      const srcItems = await sql`SELECT * FROM price_week_items WHERE price_week_id = ${src.id}`;
      for (const it of srcItems) {
        await sql`
          INSERT INTO price_week_items (price_week_id, caliber_code, purchase_mxn_kg, sale_usd_box_6kg, sale_usd_box_10kg)
          VALUES (${newWeek.id}, ${it.caliber_code}, ${it.purchase_mxn_kg}, ${it.sale_usd_box_6kg}, ${it.sale_usd_box_10kg})
        `;
      }
      return NextResponse.json(newWeek);
    }

    if (action === "publish") {
      const { week_id, user } = body;
      if (!week_id) return NextResponse.json({ error: "week_id requerido" }, { status: 400 });

      const [wk] = await sql`SELECT * FROM price_weeks WHERE id=${parseInt(week_id)}`;
      if (!wk) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

      if (wk.status === "CERRADO") return NextResponse.json({ error: "No se puede publicar una semana cerrada" }, { status: 400 });

      const items = await sql`SELECT * FROM price_week_items WHERE price_week_id=${wk.id}`;
      if (!items.length) return NextResponse.json({ error: "Debe tener al menos un calibre con precio" }, { status: 400 });
      if (!wk.exchange_rate_mxn_usd || wk.exchange_rate_mxn_usd <= 0) return NextResponse.json({ error: "Tipo de cambio inválido" }, { status: 400 });
      if (!wk.market) return NextResponse.json({ error: "Mercado requerido" }, { status: 400 });

      await sql`
        UPDATE price_weeks SET status='CERRADO' 
        WHERE week_year=${wk.week_year} AND week_number=${wk.week_number} 
          AND COALESCE(market,'') = COALESCE(${wk.market},'') 
          AND id <> ${wk.id} AND status='PUBLICADO'
      `;

      const [pub] = await sql`
        UPDATE price_weeks SET 
          status = 'PUBLICADO',
          published_at = NOW(),
          published_by = ${user || 'superadmin'},
          updated_at = NOW()
        WHERE id = ${wk.id}
        RETURNING *
      `;
      return NextResponse.json(pub);
    }

    // Normal create
    const {
      week_year, week_number, date_from, date_to, market,
      exchange_rate_mxn_usd, notes, status = "BORRADOR"
    } = body;

    if (!week_year || !week_number) {
      return NextResponse.json({ error: "Año y número de semana requeridos" }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO price_weeks (
        week_year, week_number, date_from, date_to, market,
        exchange_rate_mxn_usd, status, version, notes, created_by
      ) VALUES (
        ${parseInt(week_year)}, ${parseInt(week_number)}, ${date_from || null}, ${date_to || null}, ${market || null},
        ${parseFloat(exchange_rate_mxn_usd) || 17.2}, ${status}, 1, ${notes || null}, 'superadmin'
      ) RETURNING *
    `;

    if (Array.isArray(body.items) && body.items.length) {
      for (const it of body.items) {
        await sql`
          INSERT INTO price_week_items (price_week_id, caliber_code, purchase_mxn_kg, sale_usd_box_6kg, sale_usd_box_10kg)
          VALUES (${created.id}, ${it.caliber_code}, ${parseFloat(it.purchase_mxn_kg)||0}, ${parseFloat(it.sale_usd_box_6kg)||0}, ${parseFloat(it.sale_usd_box_10kg)||0})
        `;
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("price-weeks POST", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM price_weeks WHERE id=${parseInt(id)}`;
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (current.status === "CERRADO" && data.status !== "CERRADO") {
      return NextResponse.json({ error: "Semana cerrada, cree nueva versión" }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE price_weeks SET
        week_year = COALESCE(${data.week_year !== undefined ? parseInt(data.week_year) : null}, week_year),
        week_number = COALESCE(${data.week_number !== undefined ? parseInt(data.week_number) : null}, week_number),
        date_from = COALESCE(${data.date_from || null}, date_from),
        date_to = COALESCE(${data.date_to || null}, date_to),
        market = COALESCE(${data.market || null}, market),
        exchange_rate_mxn_usd = COALESCE(${data.exchange_rate_mxn_usd !== undefined ? parseFloat(data.exchange_rate_mxn_usd) : null}, exchange_rate_mxn_usd),
        status = COALESCE(${data.status || null}, status),
        notes = COALESCE(${data.notes || null}, notes),
        updated_at = NOW(),
        updated_by = 'superadmin'
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (e) {
    console.error("price-weeks PUT", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}