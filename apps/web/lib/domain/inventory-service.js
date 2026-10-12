import sql from "@/app/api/utils/sql";
import { LotService } from "./lot-service";

/**
 * INVENTORY SERVICE
 * Master source for physical tarimas = pallet_output_summary (1 row = 1 physical tarima).
 * warehouse_map_movements is HISTORY ONLY.
 */

const ALLOWED_PALLET_STATES = [
  'PENDIENTE_UBICACION',
  'EN_FRIO',
  'DISPONIBLE',
  'RESERVADA',
  'CARGADA',
  'EMBARCADA',
  'BLOQUEADA',
  'CANCELADA'
];

export const InventoryService = {
  getAllowedPalletStates() {
    return ALLOWED_PALLET_STATES;
  },

  async ensureInventoryLocationTable() {
    // Safe - called at startup or migration time
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_locations (
        id SERIAL PRIMARY KEY,
        location_code TEXT NOT NULL UNIQUE,
        warehouse_code TEXT,
        cold_room TEXT,
        column_code TEXT,
        row_number INTEGER,
        level_number INTEGER,
        capacity_kg NUMERIC DEFAULT 10000,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
  },

  async assignPalletToLocation({ pallet_output_id, location_code, user_id = 'sistema', user_name = 'Sistema' }) {
    if (!pallet_output_id || !location_code) {
      throw new Error('pallet_output_id y location_code son requeridos');
    }

    // Validate pallet exists and not shipped/cancelled
    const [pallet] = await sql`
      SELECT * FROM pallet_output_summary 
      WHERE id = ${parseInt(pallet_output_id)}
    `;
    if (!pallet) throw new Error('Tarima no encontrada');
    const currentState = (pallet.estado || 'PENDIENTE_UBICACION').toUpperCase();
    if (['EMBARCADA', 'CANCELADA'].includes(currentState)) {
      throw new Error('No se puede mover una tarima embarcada o cancelada');
    }

    // Validate location (create if missing for backward compat)
    let [loc] = await sql`
      SELECT * FROM inventory_locations WHERE location_code = ${location_code} LIMIT 1
    `;
    if (!loc) {
      await sql`
        INSERT INTO inventory_locations (location_code, is_active) 
        VALUES (${location_code}, true)
        ON CONFLICT (location_code) DO NOTHING
      `;
      [loc] = await sql`SELECT * FROM inventory_locations WHERE location_code = ${location_code} LIMIT 1`;
    }

    const previous = pallet.warehouse_slot || pallet.ubicacion_actual || null;

    // Atomic update of master tarima
    await sql`
      UPDATE pallet_output_summary
      SET 
        warehouse_slot = ${location_code},
        ubicacion_actual = ${location_code},
        current_location_id = ${loc ? loc.id : null},
        estado = 'EN_FRIO',
        fecha_ubicacion = NOW(),
        version_registro = COALESCE(version_registro, 0) + 1,
        updated_at = NOW()
      WHERE id = ${parseInt(pallet_output_id)}
    `;

    // History movement (never authoritative)
    await sql`
      INSERT INTO warehouse_map_movements (
        slot_id, lot_id, caliber, class_name, boxes, kilos, presentation,
        movement_type, user_id, user_name, notes, moved_at, pallet_output_id
      ) VALUES (
        ${location_code}, ${pallet.lot_id}, ${pallet.caliber}, ${pallet.class_name},
        ${pallet.pallet_count || 1}, ${pallet.total_kg || 0}, ${pallet.pallet_type || '10kg'},
        'ASSIGN', ${user_id}, ${user_name}, 
        ${previous ? 'Desde ' + previous : 'Asignación inicial'},
        NOW(), ${parseInt(pallet_output_id)}
      )
    `;

    // Central movement log (critical)
    await LotService.logMovement({
      entity_type: 'pallet',
      entity_id: parseInt(pallet_output_id),
      lot_id: pallet.lot_id,
      movement_type: 'PALLET_MOVED',
      qty_before: 0,
      qty: pallet.total_kg || 0,
      qty_after: pallet.total_kg || 0,
      unit: 'kg',
      location_from: previous,
      location_to: location_code,
      user_id,
      user_name,
      module: 'inventory',
      reference: 'assign-to-slot',
      notes: `Tarima ${pallet.folio_tarima || pallet_output_id} → ${location_code}`
    }, { required: true });

    // Rebuild lot aggregates from canonical tarimas
    if (pallet.lot_id) {
      await LotService.recalculate(pallet.lot_id);
    }

    return { success: true, pallet_output_id, location_code };
  },

  async clearPalletLocation({ pallet_output_id, user_id = 'sistema', user_name = 'Sistema' }) {
    const [pallet] = await sql`
      SELECT * FROM pallet_output_summary WHERE id = ${parseInt(pallet_output_id)}
    `;
    if (!pallet) throw new Error('Tarima no encontrada');

    const previous = pallet.warehouse_slot || pallet.ubicacion_actual;

    await sql`
      UPDATE pallet_output_summary
      SET 
        warehouse_slot = NULL,
        ubicacion_actual = NULL,
        current_location_id = NULL,
        estado = 'PENDIENTE_UBICACION',
        version_registro = COALESCE(version_registro, 0) + 1,
        updated_at = NOW()
      WHERE id = ${parseInt(pallet_output_id)}
    `;

    await sql`
      INSERT INTO warehouse_map_movements (
        slot_id, lot_id, caliber, class_name, boxes, kilos,
        movement_type, user_id, user_name, notes, moved_at, pallet_output_id
      ) VALUES (
        ${previous || 'UNKNOWN'}, ${pallet.lot_id}, ${pallet.caliber}, ${pallet.class_name},
        ${pallet.pallet_count || 1}, ${pallet.total_kg || 0},
        'CLEAR', ${user_id}, ${user_name}, 'Liberada a pendiente', NOW(), ${parseInt(pallet_output_id)}
      )
    `;

    await LotService.logMovement({
      entity_type: 'pallet',
      entity_id: parseInt(pallet_output_id),
      lot_id: pallet.lot_id,
      movement_type: 'PALLET_MOVED',
      location_from: previous,
      location_to: null,
      user_id, user_name,
      module: 'inventory',
      notes: 'CLEAR location'
    });

    if (pallet.lot_id) await LotService.recalculate(pallet.lot_id);

    return { success: true };
  },

  // Read current map directly from tarimas (never from last assign movement)
  async getCurrentColdMap() {
    const rows = await sql`
      SELECT 
        pos.id as pallet_output_id,
        pos.folio_tarima,
        pos.lot_id,
        pos.caliber,
        pos.class_name,
        pos.total_kg,
        pos.pallet_count,
        COALESCE(pos.warehouse_slot, pos.ubicacion_actual) as location_code,
        pos.estado,
        l.lot_number
      FROM pallet_output_summary pos
      LEFT JOIN lots l ON l.id = pos.lot_id
      WHERE COALESCE(pos.estado, 'PENDIENTE_UBICACION') NOT IN ('EMBARCADA','CANCELADA')
        AND (pos.warehouse_slot IS NOT NULL OR pos.ubicacion_actual IS NOT NULL)
      ORDER BY location_code
    `;
    return rows;
  }
};

export default InventoryService;
