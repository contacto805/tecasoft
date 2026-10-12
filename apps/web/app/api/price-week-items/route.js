import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get("price_week_id");
    if (!weekId) return NextResponse.json({ error: "price_week_id requerido" }, { status: 400 });

    const items = await sql`
      SELECT pwi.*, cd.display_name 
      FROM price_week_items pwi
      LEFT JOIN caliber_definitions cd ON cd.caliber_code = pwi.caliber_code
      WHERE pwi.price_week_id = ${parseInt(weekId)}
      ORDER BY pwi.id
    `;
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { price_week_id, caliber_code, purchase_mxn_kg, sale_usd_box_6kg, sale_usd_box_10kg } = await request.json();
    if (!price_week_id || !caliber_code) return NextResponse.json({ error: "price_week_id y caliber_code requeridos" }, { status: 400 });

    const [created] = await sql`
      INSERT INTO price_week_items (price_week_id, caliber_code, purchase_mxn_kg, sale_usd_box_6kg, sale_usd_box_10kg)
      VALUES (${parseInt(price_week_id)}, ${caliber_code}, ${parseFloat(purchase_mxn_kg)||0}, ${parseFloat(sale_usd_box_6kg)||0}, ${parseFloat(sale_usd_box_10kg)||0})
      RETURNING *
    `;
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, purchase_mxn_kg, sale_usd_box_6kg, sale_usd_box_10kg } = await request.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [updated] = await sql`
      UPDATE price_week_items SET
        purchase_mxn_kg = COALESCE(${purchase_mxn_kg !== undefined ? parseFloat(purchase_mxn_kg) : null}, purchase_mxn_kg),
        sale_usd_box_6kg = COALESCE(${sale_usd_box_6kg !== undefined ? parseFloat(sale_usd_box_6kg) : null}, sale_usd_box_6kg),
        sale_usd_box_10kg = COALESCE(${sale_usd_box_10kg !== undefined ? parseFloat(sale_usd_box_10kg) : null}, sale_usd_box_10kg),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}