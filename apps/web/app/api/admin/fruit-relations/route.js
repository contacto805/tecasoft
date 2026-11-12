import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString().split("T")[0];
    const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];
    const producerFilter = (searchParams.get("producer") || "").trim();

    let baseWhere = sql`l.date >= ${startDate} AND l.date <= ${endDate}`;
    if (producerFilter) {
      baseWhere = sql`${baseWhere} AND l.producer ILIKE ${"%" + producerFilter + "%"}`;
    }

    const rows = await sql`
      SELECT 
        l.id,
        l.date,
        l.producer,
        l.lot_number,
        COALESCE(l.total_kg_received, 0) as kg,
        COALESCE(l.fruit_price, 0) as fruit_price,
        COALESCE(l.status, '') as lot_status,
        (SELECT COALESCE(SUM(fiw.total_kg_weighed), 0) FROM fruit_input_weighings fiw WHERE fiw.lot_id = l.id) as weighed_kg,
        (SELECT COUNT(*) FROM lot_accountant_documents lac WHERE lac.lot_id = l.id) as accountant_docs,
        ps.id IS NOT NULL as has_schedule,
        COALESCE(ps.status, '') as payment_status,
        ps.invoice_file_url IS NOT NULL as has_invoice,
        ps.payment_proof_url IS NOT NULL as has_proof,
        COALESCE(ps.amount, 0) as scheduled_amount
      FROM lots l
      LEFT JOIN payment_schedule ps ON ps.lot_id = l.id
      WHERE ${baseWhere}
      ORDER BY l.date DESC, l.producer ASC, l.lot_number ASC
      LIMIT 400
    `;

    // Dedupe by lot id (LEFT JOIN on payment_schedule can duplicate rows if multiple schedules per lot)
    const seen = new Set();
    const uniqueRows = rows.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const entries = uniqueRows.map((r) => {
      const kg = parseFloat(r.weighed_kg || r.kg || 0) || 0;
      const price = parseFloat(r.fruit_price || 0) || 0;
      const estAmount = Math.round(kg * price * 100) / 100;

      let docStatus = "pendiente";
      let docLabel = "Sin documentación";

      const docsCount = parseInt(r.accountant_docs || 0);
      const scheduled = !!r.has_schedule;
      const hasFiles = r.has_invoice || r.has_proof;

      if (r.payment_status === "pagado" || (scheduled && hasFiles)) {
        docStatus = "completa";
        docLabel = "Documentación completa";
      } else if (scheduled || docsCount > 0 || hasFiles) {
        docStatus = "parcial";
        docLabel = docsCount > 0 ? `Parcial (${docsCount} doc${docsCount > 1 ? "s" : ""})` : "Programado sin comprobantes";
      }

      return {
        id: r.id,
        date: r.date,
        producer: r.producer || "Sin productor",
        lot_number: r.lot_number,
        kg: kg,
        fruit_price: price,
        estAmount,
        lot_status: r.lot_status,
        docStatus,
        docLabel,
        accountant_docs: docsCount,
        has_schedule: scheduled,
      };
    });

    const summary = {
      totalLots: entries.length,
      totalKg: Math.round(entries.reduce((s, e) => s + (e.kg || 0), 0) * 100) / 100,
      totalEst: Math.round(entries.reduce((s, e) => s + (e.estAmount || 0), 0) * 100) / 100,
      producersCount: [...new Set(entries.map((e) => e.producer))].length,
    };

    const producers = [...new Set(entries.map((e) => e.producer))].sort();

    return NextResponse.json({ entries, summary, producers, filters: { startDate, endDate, producerFilter } });
  } catch (error) {
    console.error("Error en /api/admin/fruit-relations:", error);
    return NextResponse.json({ error: "No se pudo cargar la relación de fruta", entries: [], summary: { totalLots: 0, totalKg: 0, totalEst: 0, producersCount: 0 }, producers: [] }, { status: 200 });
  }
}
