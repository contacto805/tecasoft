import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const estatus = searchParams.get("estatus");

    const rows = await sql`
      SELECT n.*,c.customer_name,v.folio AS viaje_folio,v.valor_usd AS viaje_valor,
        shipment.moneda,shipment.importe,shipment.kilos
      FROM notas n LEFT JOIN customers c ON c.id=n.customer_id
      LEFT JOIN viajes v ON v.id=n.viaje_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN COUNT(DISTINCT h.currency)=1 THEN MIN(h.currency) END AS moneda,
          CASE WHEN COUNT(DISTINCT h.currency)=1 THEN SUM(h.total_amount) END AS importe,SUM(h.total_kg) AS kilos
        FROM load_history h WHERE h.customer_id=n.customer_id AND h.factura_folio=n.folio
          AND LOWER(COALESCE(h.payment_status,'')) NOT IN ('canceled','cancelled','cancelado','cancelada','anulado')
      ) shipment ON true
      WHERE (${customerId}::text IS NULL OR n.customer_id::text=${customerId})
        AND (${estatus}::text IS NULL OR n.estatus=${estatus})
      ORDER BY n.fecha DESC,n.id DESC LIMIT 200
    `;
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
