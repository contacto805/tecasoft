import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    const [counts] = await sql`
      SELECT 
        (SELECT COUNT(*) FROM orchard_visits WHERE visit_date = ${today}) as today_visits,
        (SELECT COUNT(*) FROM orchard_visits WHERE visit_date >= ${weekAgo}) as week_visits,
        (SELECT COUNT(DISTINCT producer) FROM orchard_visits WHERE visit_date >= ${weekAgo}) as week_producers,
        (SELECT COUNT(*) FROM negotiations WHERE status = 'En negociación') as neg_open,
        (SELECT COUNT(*) FROM negotiations WHERE status IN ('Aceptada','Cortada')) as neg_closed
    `;

    const calcs = await sql`
      SELECT 
        SUM(est_kg) as kg_negotiated,
        AVG(offered_price) as avg_price
      FROM orchard_visits v
      LEFT JOIN negotiations n ON n.visit_id = v.id
      WHERE v.visit_date >= ${weekAgo}
    `;

    const [statsCuts] = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status='Cortada') as cortados,
        SUM(CASE WHEN n.status IN ('Aceptada','Cortada') THEN 1 ELSE 0 END) as concretadas,
        COUNT(*) FILTER (WHERE status='Rechazada') as rechazadas,
        COUNT(*) as tot_neg
      FROM negotiations n
    `;

    const kgNegotiated = parseFloat(calcs[0]?.kg_negotiated || 0);
    const conversion = statsCuts.tot_neg > 0 ? Math.round(statsCuts.concretadas * 100 / statsCuts.tot_neg) : 0;

    const [traveled] = await sql`
      SELECT COALESCE(SUM(total_km), 0) as km
      FROM journey_logs
      WHERE date >= ${weekAgo}
    `;

    return NextResponse.json({
      today_visits: parseInt(counts.today_visits || 0),
      week_visits: parseInt(counts.week_visits || 0),
      week_producers: parseInt(counts.week_producers || 0),
      neg_open: parseInt(counts.neg_open || 0),
      neg_closed: parseInt(counts.neg_closed || 0),
      kg_negotiated: kgNegotiated,
      avg_price: parseFloat(calcs[0]?.avg_price || 0),
      conversion_pct: conversion,
      rejected_pct: statsCuts.tot_neg > 0 ? Math.round((statsCuts.rechazadas || 0) * 100 / statsCuts.tot_neg) : 0,
      tons_cut: Math.round(parseFloat(statsCuts.cortados || 0) * (kgNegotiated || 10000) / 10000),
      km_traveled: parseFloat(traveled.km || 0)
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
