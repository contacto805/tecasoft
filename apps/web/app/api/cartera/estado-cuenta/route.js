import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) return NextResponse.json({ error: "customerId requerido" }, { status: 400 });

    const cid = parseInt(customerId);

    // Aggregate from new module + existing for full trace
    const movimientos = [];

    // Viajes
    const viajes = await sql`
      SELECT 'Viaje' as tipo, v.folio, v.fecha_salida as fecha, v.valor_usd as cargo, 0 as abono, v.estatus, v.destino
      FROM viajes v WHERE v.customer_id = ${cid}
    `;
    viajes.forEach(r => movimientos.push({ ...r, cargo: parseFloat(r.cargo)||0, abono: 0 }));

    // Notas
    const notas = await sql`
      SELECT 'Nota' as tipo, n.folio, n.fecha, n.importe_original_usd as cargo, n.total_abonado_usd as abono, n.saldo_usd as saldo, n.estatus
      FROM notas n WHERE n.customer_id = ${cid}
    `;
    notas.forEach(r => movimientos.push({ ...r, cargo: parseFloat(r.cargo)||0, abono: parseFloat(r.abono)||0 }));

    // Facturas CFDI
    const facts = await sql`
      SELECT 'Factura' as tipo, f.folio_interno as folio, f.fecha_timbrado as fecha, f.importe_usd as cargo, 0 as abono, f.uso_factura as estatus
      FROM cfdi_facturas f WHERE f.customer_id = ${cid}
    `;
    facts.forEach(r => movimientos.push({ ...r, cargo: parseFloat(r.cargo)||0, abono: 0 }));

    // Abonos
    const abs = await sql`
      SELECT 'Depósito' as tipo, a.folio, a.fecha, 0 as cargo, a.equivalente_usd as abono, a.moneda_recibida as moneda
      FROM abonos a WHERE a.customer_id = ${cid}
    `;
    abs.forEach(r => movimientos.push({ ...r, cargo: 0, abono: parseFloat(r.abono)||0 }));

    // Aplicaciones as separate for detail
    const apps = await sql`
      SELECT 'Aplicación' as tipo, 'AP-'||ap.id as folio, ap.fecha_aplicacion as fecha, 0 as cargo, ap.monto_aplicado_usd as abono, n.folio as ref_nota
      FROM abono_aplicaciones ap LEFT JOIN notas n ON ap.nota_id = n.id
      WHERE n.customer_id = ${cid}
    `;
    apps.forEach(r => movimientos.push({ ...r, cargo: 0, abono: parseFloat(r.abono)||0 }));

    // Also pull from existing customer_accounts + load_history for compatibility
    const legacy = await sql`
      SELECT 'Cuenta' as tipo, ca.description as folio, ca.trip_date as fecha, 
             CASE WHEN ca.transaction_type ILIKE '%charge%' THEN ca.amount_usd ELSE 0 END as cargo,
             CASE WHEN ca.transaction_type ILIKE '%payment%' THEN ca.amount_usd ELSE 0 END as abono
      FROM customer_accounts ca WHERE ca.customer_id = ${cid}
    `;
    legacy.forEach(r => movimientos.push({ ...r, cargo: parseFloat(r.cargo)||0, abono: parseFloat(r.abono)||0 }));

    // Sort chrono
    movimientos.sort((a,b) => (a.fecha || '').localeCompare(b.fecha || ''));

    // Running saldo (USD primary)
    let saldo = 0;
    const out = movimientos.map(m => {
      saldo += (parseFloat(m.cargo)||0) - (parseFloat(m.abono)||0);
      return { ...m, saldo_running: Math.round(saldo * 100) / 100 };
    });

    // Summary
    const totalCargo = out.reduce((s, m) => s + (parseFloat(m.cargo)||0), 0);
    const totalAbono = out.reduce((s, m) => s + (parseFloat(m.abono)||0), 0);
    const saldoPend = Math.round((totalCargo - totalAbono) * 100) / 100;

    return NextResponse.json({
      movimientos: out,
      resumen: {
        total_cargo_usd: Math.round(totalCargo * 100) / 100,
        total_abono_usd: Math.round(totalAbono * 100) / 100,
        saldo_pendiente_usd: saldoPend,
        total_viajes: viajes.length,
        total_abonos: abs.length
      }
    });
  } catch (e) {
    console.error("estado-cuenta", e);
    return NextResponse.json({ error: "Error estado cuenta" }, { status: 500 });
  }
}
