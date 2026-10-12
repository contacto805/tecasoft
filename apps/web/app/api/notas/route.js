import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const estatus = searchParams.get("estatus");

    let q = sql`
      SELECT n.*, c.customer_name, v.folio as viaje_folio, v.valor_usd as viaje_valor
      FROM notas n
      LEFT JOIN customers c ON n.customer_id = c.id
      LEFT JOIN viajes v ON n.viaje_id = v.id
      ORDER BY n.fecha DESC, n.id DESC LIMIT 200
    `;
    if (customerId) {
      q = sql`
        SELECT n.*, c.customer_name, v.folio as viaje_folio
        FROM notas n LEFT JOIN customers c ON n.customer_id = c.id
        LEFT JOIN viajes v ON n.viaje_id = v.id
        WHERE n.customer_id = ${parseInt(customerId)} ORDER BY n.fecha DESC
      `;
    }
    const rows = await q;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error notas" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, total_abonado_usd, saldo_usd, estatus } = await request.json();
    const [row] = await sql`
      UPDATE notas SET 
        total_abonado_usd = ${parseFloat(total_abonado_usd) || 0},
        saldo_usd = ${parseFloat(saldo_usd) || 0},
        estatus = ${estatus || 'Parcial'},
        updated_at = NOW()
      WHERE id = ${parseInt(id)} RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
