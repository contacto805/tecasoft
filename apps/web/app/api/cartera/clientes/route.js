import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT 
        c.id, c.customer_name, c.destination, c.rfc,
        COUNT(DISTINCT v.id) as viajes,
        COALESCE(SUM(v.valor_usd),0) as total_vendido,
        COALESCE(SUM(n.total_abonado_usd),0) as total_pagado,
        COALESCE(SUM(n.saldo_usd),0) as saldo,
        COUNT(DISTINCT CASE WHEN n.saldo_usd > 0.5 THEN n.id END) as facturas_pendientes
      FROM customers c
      LEFT JOIN viajes v ON v.customer_id = c.id
      LEFT JOIN notas n ON n.customer_id = c.id
      GROUP BY c.id, c.customer_name, c.destination, c.rfc
      ORDER BY saldo DESC
      LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json([]);
  }
}
