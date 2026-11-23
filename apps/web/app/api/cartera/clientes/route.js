import sql from "@/app/api/utils/sql";
import {NextResponse} from "next/server";

export async function GET() {
  try {
    // Aggregate each source before joining so multiple lot lines cannot multiply the balance.
    const rows = await sql`
      WITH balances AS (
        SELECT customer_id, SUM(importe_original_usd) AS vendido,SUM(total_abonado_usd) AS pagado,
          SUM(saldo_usd) AS saldo,COUNT(*) FILTER(WHERE saldo_usd > 0) AS pendientes
        FROM notas WHERE LOWER(COALESCE(estatus,'')) NOT IN ('cancelado','cancelada','anulado','anulada')
        GROUP BY customer_id
      ), loads AS (
        SELECT customer_id,COUNT(DISTINCT COALESCE(NULLIF(factura_folio,''),'#'||id)) AS count
        FROM load_history WHERE LOWER(COALESCE(payment_status,'')) NOT IN ('canceled','cancelled','cancelado','cancelada','anulado')
        GROUP BY customer_id
      ), trips AS (
        SELECT customer_id,COUNT(*) AS count FROM viajes GROUP BY customer_id
      )
      SELECT c.id,c.customer_name,c.destination,c.rfc,COALESCE(l.count,0) AS cargas,
        GREATEST(COALESCE(v.count,0),COALESCE(l.count,0)) AS viajes,
        COALESCE(b.vendido,0) AS total_vendido,COALESCE(b.pagado,0) AS total_pagado,
        COALESCE(b.saldo,0) AS saldo,COALESCE(b.pendientes,0) AS notas_pendientes,
        COALESCE(b.pendientes,0) AS facturas_pendientes
      FROM customers c LEFT JOIN balances b ON b.customer_id=c.id
      LEFT JOIN loads l ON l.customer_id=c.id LEFT JOIN trips v ON v.customer_id=c.id
      ORDER BY saldo DESC,c.id LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Cartera por cliente:',error.message);
    return NextResponse.json({error:'No se pudo consultar cartera.'},{status:500});
  }
}
