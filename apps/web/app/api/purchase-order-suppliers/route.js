import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const rows = await sql`SELECT * FROM purchase_order_suppliers WHERE id = ${parseInt(id)} LIMIT 1`;
      return NextResponse.json(rows[0] || null);
    }
    const rows = await sql`SELECT * FROM purchase_order_suppliers WHERE is_active IS NOT FALSE ORDER BY supplier_name ASC LIMIT 200`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const d = await request.json();
    const [row] = await sql`
      INSERT INTO purchase_order_suppliers (supplier_name, rfc, contact_phone, contact_email, address, tipo_proveedor, categoria, banco, cuenta, clabe, titular)
      VALUES (${d.supplier_name}, ${d.rfc || null}, ${d.contact_phone || null}, ${d.contact_email || null}, ${d.address || null}, ${d.tipo_proveedor || null}, ${d.categoria || null}, ${d.banco || null}, ${d.cuenta || null}, ${d.clabe || null}, ${d.titular || null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
