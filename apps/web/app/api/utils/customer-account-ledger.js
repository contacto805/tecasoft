import sql from "@/app/api/utils/sql";

/**
 * Canonical ledger for client portal.
 * Charges come ONLY from notas.importe_original_usd
 * Credits come ONLY from abonos.equivalente_usd
 * abono_aplicaciones are details only (not subtracted again).
 * Legacy tables used ONLY as fallback when no matching nota/abono exists.
 */

export async function getCustomerLedger(customerId, fromDate = null, toDate = null) {
  const cid = parseInt(customerId);
  if (!cid) throw new Error("customerId requerido");

  const whereDate = [];
  if (fromDate) whereDate.push(`fecha >= '${fromDate}'`);
  if (toDate) whereDate.push(`fecha <= '${toDate}'`);
  const dateFilter = whereDate.length ? `AND ${whereDate.join(" AND ")}` : "";

  // 1. Cargos: Notas (principal)
  const notas = await sql`
    SELECT 
      'CARGO' as tipo,
      n.folio,
      n.fecha,
      n.importe_original_usd as cargo,
      0 as abono,
      n.saldo_usd as saldo_nota,
      COALESCE(v.folio, '') as ref_viaje,
      n.viaje_id,
      n.id as nota_id,
      'Nota' as origen
    FROM notas n
    LEFT JOIN viajes v ON v.id = n.viaje_id
    WHERE n.customer_id = ${cid}
    ${fromDate ? sql`AND n.fecha >= ${fromDate}` : sql``}
    ${toDate ? sql`AND n.fecha <= ${toDate}` : sql``}
    ORDER BY n.fecha ASC, n.id ASC
  `;

  // 2. Abonos / Pagos
  const abonos = await sql`
    SELECT 
      'ABONO' as tipo,
      a.folio,
      a.fecha,
      0 as cargo,
      a.equivalente_usd as abono,
      a.moneda_recibida,
      a.importe_recibido,
      a.tipo_cambio,
      a.id as abono_id,
      (a.equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones WHERE abono_id = a.id), 0)) as disponible,
      'Depósito' as origen
    FROM abonos a
    WHERE a.customer_id = ${cid}
    ${fromDate ? sql`AND a.fecha >= ${fromDate}` : sql``}
    ${toDate ? sql`AND a.fecha <= ${toDate}` : sql``}
    ORDER BY a.fecha ASC, a.id ASC
  `;

  // 3. Build chronological movements (prefer notas + abonos)
  let movements = [];

  notas.forEach(n => {
    movements.push({
      fecha: n.fecha,
      tipo: "CARGO",
      folio: n.folio,
      concepto: n.ref_viaje ? `Viaje ${n.ref_viaje}` : "Cargo",
      cargo: parseFloat(n.cargo) || 0,
      abono: 0,
      ref: n,
    });
  });

  abonos.forEach(a => {
    movements.push({
      fecha: a.fecha,
      tipo: "ABONO",
      folio: a.folio,
      concepto: `Pago ${a.moneda_recibida || 'USD'}`,
      cargo: 0,
      abono: parseFloat(a.abono) || 0,
      ref: a,
    });
  });

  // Sort by date then type (cargos before abonos on same day)
  movements.sort((a, b) => {
    if (a.fecha !== b.fecha) return (a.fecha || '').localeCompare(b.fecha || '');
    if (a.tipo === 'CARGO' && b.tipo === 'ABONO') return -1;
    if (a.tipo === 'ABONO' && b.tipo === 'CARGO') return 1;
    return 0;
  });

  // Running balance
  let running = 0;
  const out = movements.map(m => {
    running += (m.cargo || 0) - (m.abono || 0);
    return { ...m, saldo_acumulado: Math.round(running * 100) / 100 };
  });

  // Summary from authoritative tables
  const [saldoNotas] = await sql`
    SELECT COALESCE(SUM(saldo_usd), 0) as saldo_pendiente FROM notas WHERE customer_id = ${cid}
  `;
  const [totalCargos] = await sql`
    SELECT COALESCE(SUM(importe_original_usd), 0) as total FROM notas WHERE customer_id = ${cid}
  `;
  const [totalAbonos] = await sql`
    SELECT COALESCE(SUM(equivalente_usd), 0) as total FROM abonos WHERE customer_id = ${cid}
  `;
  const [anticipos] = await sql`
    SELECT COALESCE(SUM(equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones aa WHERE aa.abono_id = a.id),0)), 0) as total
    FROM abonos a WHERE customer_id = ${cid}
  `;
  const [viajesCount] = await sql`
    SELECT COUNT(*) as c FROM viajes WHERE customer_id = ${cid}
  `;

  const saldoPendiente = Math.round((saldoNotas?.saldo_pendiente || 0) * 100) / 100;
  const anticiposDisp = Math.round((anticipos?.total || 0) * 100) / 100;
  const neto = saldoPendiente - anticiposDisp;

  return {
    movimientos: out,
    resumen: {
      saldo_por_pagar_usd: saldoPendiente,
      total_cargos_usd: Math.round((totalCargos?.total || 0) * 100) / 100,
      total_abonos_usd: Math.round((totalAbonos?.total || 0) * 100) / 100,
      anticipos_disponibles_usd: anticiposDisp,
      saldo_neto_usd: Math.round(neto * 100) / 100,
      es_saldo_a_favor: neto < 0,
      total_viajes: parseInt(viajesCount?.c || 0),
    },
  };
}

export async function getCustomerTrips(customerId) {
  const cid = parseInt(customerId);
  const rows = await sql`
    SELECT v.*, 
           n.folio as nota_folio, n.importe_original_usd, n.total_abonado_usd, n.saldo_usd, n.estatus as nota_estatus
    FROM viajes v
    LEFT JOIN notas n ON n.viaje_id = v.id
    WHERE v.customer_id = ${cid}
    ORDER BY v.fecha_salida DESC, v.id DESC
    LIMIT 200
  `;
  return rows.map(r => ({
    ...r,
    saldo: r.saldo_usd || (parseFloat(r.valor_usd) - (parseFloat(r.total_abonado_usd) || 0)),
  }));
}

export async function getCustomerPayments(customerId) {
  const cid = parseInt(customerId);
  const abonos = await sql`
    SELECT a.*,
      (a.equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones WHERE abono_id = a.id),0)) as disponible_usd
    FROM abonos a
    WHERE a.customer_id = ${cid}
    ORDER BY a.fecha DESC
  `;

  // Attach applications for each
  const result = [];
  for (const a of abonos) {
    const apps = await sql`
      SELECT ap.*, n.folio as nota_folio, v.folio as viaje_folio
      FROM abono_aplicaciones ap
      LEFT JOIN notas n ON n.id = ap.nota_id
      LEFT JOIN viajes v ON v.id = ap.viaje_id
      WHERE ap.abono_id = ${a.id}
      ORDER BY ap.fecha_aplicacion DESC
    `;
    result.push({ ...a, aplicaciones: apps });
  }
  return result;
}
