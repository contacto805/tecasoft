import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: available tarimas for reempaque + list of reempaques
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "available";

    if (type === "available") {
      // Available tarimas: not embarked, not reserved/sold
      let rows = await sql`
        SELECT 
          p.id, p.folio_tarima, p.lot_id, p.lot_number, p.caliber, p.class_name,
          p.pallet_count, p.total_kg, p.packing_date, p.cold_date, p.warehouse_slot,
          p.estado, p.ubicacion_actual
        FROM pallet_output_summary p
        WHERE COALESCE(p.estado,'') NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
        ORDER BY p.cold_date DESC NULLS LAST, p.id DESC
        LIMIT 200
      `;
      if (q) {
        const qq = `%${q.toLowerCase()}%`;
        rows = rows.filter(r =>
          (r.folio_tarima || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.lot_number || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.caliber || '').toLowerCase().includes(q.toLowerCase())
        );
      }
      return NextResponse.json(rows);
    }

    // list reempaques
    const ops = await sql`
      SELECT * FROM reempaque_operations ORDER BY created_at DESC LIMIT 50
    `;
    return NextResponse.json(ops);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: create/confirm reempaque
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      selected_pallets = [], // [{id, kg_to_withdraw}]
      operation_date,
      responsible,
      reason,
      reselection = [], // [{source_pallet_id, destination_type, kg, caliber_to, class_to}]
      additional_costs = {},
      notes
    } = body;

    if (!selected_pallets.length) {
      return NextResponse.json({ error: "Selecciona al menos una tarima" }, { status: 400 });
    }

    // Generate folio
    const max = await sql`SELECT folio FROM reempaque_operations ORDER BY id DESC LIMIT 1`;
    let num = 1;
    if (max.length && max[0].folio) {
      const m = String(max[0].folio).match(/(\d+)$/);
      if (m) num = parseInt(m[1]) + 1;
    }
    const folio = `REEMP-${String(num).padStart(6, "0")}`;

    const date = operation_date || new Date().toISOString().slice(0,10);

    // Insert operation
    const [op] = await sql`
      INSERT INTO reempaque_operations (folio, operation_date, responsible, reason, status, notes, additional_costs)
      VALUES (${folio}, ${date}, ${responsible || 'Operador'}, ${reason || 'Reempaque'}, 'CONFIRMADO', ${notes || ''}, ${JSON.stringify(additional_costs)}::jsonb)
      RETURNING *
    `;

    let totalWithdrawn = 0;
    let totalRec = 0;
    let totalProc = 0;
    let totalDes = 0;
    let totalMer = 0;

    for (const sp of selected_pallets) {
      const pid = parseInt(sp.id);
      const kgW = parseFloat(sp.kg_to_withdraw || 0);
      if (!pid || !kgW) continue;

      totalWithdrawn += kgW;

      // Get current pallet info
      const [pal] = await sql`SELECT * FROM pallet_output_summary WHERE id = ${pid}`;
      if (!pal) continue;

      const newKg = Math.max(0, parseFloat(pal.total_kg || 0) - kgW);
      const isFull = newKg < 1;

      // Update source
      await sql`
        UPDATE pallet_output_summary 
        SET total_kg = ${newKg}, 
            pallet_count = CASE WHEN ${isFull} THEN 0 ELSE COALESCE(pallet_count,1) END,
            estado = ${isFull ? 'REEMPACADA' : 'DISPONIBLE'},
            updated_at = NOW()
        WHERE id = ${pid}
      `;

      // Record details from reselection for this pallet
      const detailsForP = reselection.filter(d => parseInt(d.source_pallet_id) === pid);
      for (const d of detailsForP) {
        const dkg = parseFloat(d.kg || 0);
        if (dkg <= 0) continue;

        const dt = d.destination_type || 'recuperada';
        if (dt.includes('proceso')) totalProc += dkg;
        else if (dt.includes('desecho')) totalDes += dkg;
        else if (dt.includes('merma')) totalMer += dkg;
        else totalRec += dkg;

        await sql`
          INSERT INTO reempaque_details (reempaque_id, source_pallet_id, lot_id, caliber_from, class_from, destination_type, caliber_to, class_to, kg, boxes)
          VALUES (${op.id}, ${pid}, ${pal.lot_id}, ${pal.caliber}, ${pal.class_name}, ${dt}, ${d.caliber_to || pal.caliber}, ${d.class_to || pal.class_name}, ${dkg}, ${Math.round(dkg / 10)})
        `;
      }
    }

    // Update totals on op
    await sql`
      UPDATE reempaque_operations 
      SET total_kg_withdrawn = ${totalWithdrawn},
          total_kg_recovered = ${totalRec},
          total_kg_to_process = ${totalProc},
          total_kg_to_desecho = ${totalDes},
          total_kg_merma = ${totalMer},
          source_pallet_ids = ${JSON.stringify(selected_pallets.map(s => s.id))}::jsonb
      WHERE id = ${op.id}
    `;

    // Record movement for traceability
    try {
      await sql`
        INSERT INTO movements (entity_type, entity_id, movement_type, qty, unit, module, reference, notes)
        VALUES ('reempaque', ${op.id}, 'REEMPAQUE', ${totalWithdrawn}, 'kg', 'reempaque', ${folio}, ${reason || ''})
      `;
    } catch (_) {}

    // Integrar costo adicional al cierre (fecha real de operación) y operating_costs para finanzas
    try {
      const ac = additional_costs || {};
      const totalAdd = (parseFloat(ac.mano_obra)||0) + (parseFloat(ac.materiales)||0) + (parseFloat(ac.otros)||0);
      if (totalAdd > 0) {
        await sql`
          INSERT INTO operating_costs (folio, cost_date, week_number, week_year, cost_type, cost_category, cost_concept, description, amount, currency, module_origin, status, created_at)
          VALUES (${folio}, ${date}, EXTRACT(WEEK FROM ${date}::date), EXTRACT(YEAR FROM ${date}::date), 'reempaque', 'operativo', 'Reempaque', ${reason || 'Reempaque'}, ${totalAdd}, 'MXN', 'reempaque', 'confirmado', NOW())
        `;
      }
    } catch (_) {}

    return NextResponse.json({ success: true, op, folio });
  } catch (e) {
    console.error("reempaque error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}