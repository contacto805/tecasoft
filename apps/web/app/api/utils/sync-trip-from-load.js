import sql from "@/app/api/utils/sql";

/**
 * Central idempotent sync: links a confirmed load_history to its commercial viaje.
 * - Uses load_history as source of truth for the commercial operation.
 * - Creates/updates ONE viajes record (direct insert, no auto-nota creation).
 * - Also maintains customer_trips link for compatibility.
 * - Never creates notas, abonos or additional charges.
 * - Safe for re-runs, concurrent calls and historical loads.
 */
export async function syncCommercialTripFromLoad(loadHistoryId, userName = 'sistema') {
  const lid = parseInt(loadHistoryId);
  if (!lid) return { skipped: true, reason: 'invalid load id' };

  const [load] = await sql`SELECT * FROM load_history WHERE id = ${lid}`;
  if (!load) return { skipped: true, reason: 'load not found' };

  // Only commercial operations with a real customer
  if (!load.customer_id) {
    return { skipped: true, reason: 'no customer_id - non commercial or internal transfer' };
  }

  // 1. Check for existing linked viaje (idempotency)
  const [existing] = await sql`
    SELECT * FROM viajes WHERE load_history_id = ${lid} LIMIT 1
  `;
  if (existing) {
    // Update only safe operational fields
    await sql`
      UPDATE viajes SET
        fecha_salida = COALESCE(${load.load_date}, fecha_salida),
        destino = COALESCE(${load.destination}, destino),
        numero_cajas = ${parseInt(load.boxes_count) || 0},
        peso = ${parseFloat(load.total_kg) || 0},
        valor_usd = ${parseFloat(load.total_amount) || 0},
        transportista = COALESCE(${load.driver_name}, transportista),
        placas = COALESCE(${load.truck_plates}, placas),
        observaciones = COALESCE(${load.notes}, observaciones),
        updated_by = ${userName},
        updated_at = NOW()
      WHERE id = ${existing.id}
    `;
    return { updated: true, viajeId: existing.id, loadId: lid };
  }

  // 2. Generate folio V- (simple, server side)
  const maxF = await sql`SELECT folio FROM viajes WHERE folio LIKE 'V-%' ORDER BY folio DESC LIMIT 1`;
  let next = 1;
  if (maxF.length && maxF[0]?.folio) {
    const n = parseInt(String(maxF[0].folio).replace('V-', '')) || 0;
    next = n + 1;
  }
  const folio = 'V-' + String(next).padStart(6, '0');

  // 3. Insert linked viaje (direct, bypasses auto-nota in viajes POST)
  const [viaje] = await sql`
    INSERT INTO viajes (
      folio, fecha_salida, customer_id, destino,
      transportista, operador, unidad, placas, caja_remolque,
      numero_cajas, peso, valor_usd, estatus,
      observaciones, created_by, load_history_id, numero_carga, referencia_interna
    ) VALUES (
      ${folio}, ${load.load_date}, ${load.customer_id}, ${load.destination},
      ${load.driver_name || null}, null, null, ${load.truck_plates || null}, null,
      ${parseInt(load.boxes_count) || 0}, ${parseFloat(load.total_kg) || 0}, ${parseFloat(load.total_amount) || 0}, 'Confirmado',
      ${load.notes || null}, ${userName}, ${lid}, ${load.factura_folio || null}, ${'Carga-' + lid}
    ) RETURNING *
  `;

  // 4. Maintain customer_trips link (for dashboards using that table)
  const ct = await sql`SELECT id FROM customer_trips WHERE load_history_id = ${lid} LIMIT 1`;
  if (!ct.length) {
    await sql`
      INSERT INTO customer_trips (
        customer_id, load_history_id, trip_date, total_kg, boxes_count,
        price_per_trip, currency, status, notes
      ) VALUES (
        ${load.customer_id}, ${lid}, ${load.load_date},
        ${parseFloat(load.total_kg) || 0}, ${parseInt(load.boxes_count) || 0},
        ${parseFloat(load.total_amount) || 0}, ${load.currency || 'USD'},
        'activo', ${load.notes || null}
      )
    `;
  }

  return { created: true, viajeId: viaje.id, loadId: lid };
}

export default { syncCommercialTripFromLoad };