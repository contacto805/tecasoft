import sql from "@/app/api/utils/sql";
import {coldSlotPattern,floor,palletPosition,trailerSlotPattern} from "@/utils/shipment-map";

export const palletLocationLock = () => sql`SELECT pg_advisory_xact_lock(hashtext('tecavo-confirm-shipment'))`;

export async function movePhysicalPallet({id,target,expected=null,sourceSlot=null,allowTrailer=true,user}) {
  if ((id == null && !sourceSlot) || (id != null && !/^\d+$/.test(String(id))) ||
      !(target === floor || coldSlotPattern.test(target) || (allowTrailer && trailerSlotPattern.test(target)))) {
    return {status:400,error:'Tarima o posición inválida.'};
  }
  if (sourceSlot && !coldSlotPattern.test(sourceSlot)) return {status:400,error:'Posición de frío inválida.'};

  const trailer = trailerSlotPattern.test(target);
  const [, [row]] = await sql.transaction([
    palletLocationLock(),
    sql`
      WITH active AS (
        SELECT p.*, UPPER(TRIM(COALESCE(p.warehouse_slot,''))) AS cold,
          UPPER(TRIM(COALESCE(p.ubicacion_actual,''))) AS current,
          CASE WHEN UPPER(TRIM(COALESCE(p.ubicacion_actual,''))) ~ '^(TRAILER-(0[1-9]|1[0-9]|2[0-8])|[ABC]-([1-9]|1[0-3]))$'
            THEN UPPER(TRIM(p.ubicacion_actual))
            WHEN UPPER(TRIM(COALESCE(p.warehouse_slot,''))) ~ '^[ABC]-([1-9]|1[0-3])$'
            THEN UPPER(TRIM(p.warehouse_slot)) ELSE 'PISO' END AS position
        FROM pallet_output_summary p
        WHERE p.embarque_id IS NULL AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
      ), source AS (
        SELECT * FROM active WHERE (${id}::bigint IS NOT NULL AND id=${id}::bigint)
          OR (${id}::bigint IS NULL AND position=${sourceSlot})
        ORDER BY id LIMIT 1
      ), occupied AS (
        SELECT a.id FROM active a, source s WHERE a.id<>s.id AND ${target} <> 'PISO'
          AND (a.position=${target} OR (a.position LIKE 'TRAILER-%' AND a.cold=${target}))
        LIMIT 1
      ), moved AS (
        UPDATE pallet_output_summary p SET
          warehouse_slot=CASE WHEN ${trailer} THEN
            CASE WHEN s.position LIKE 'TRAILER-%' THEN s.warehouse_slot
              WHEN s.position='PISO' THEN NULL ELSE s.position END
            WHEN ${target}='PISO' THEN NULL ELSE ${target} END,
          ubicacion_actual=CASE WHEN ${target}='PISO' THEN NULL ELSE ${target} END,
          estado=CASE WHEN ${target}='PISO' THEN 'PENDIENTE_UBICACION'
             WHEN ${trailer} THEN p.estado ELSE 'EN_FRIO' END,
          fecha_ubicacion=NOW(), updated_at=NOW(),version_registro=COALESCE(p.version_registro,1)+1
        FROM source s WHERE p.id=s.id AND p.embarque_id IS NULL
          AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
          AND (${expected}::text IS NULL OR s.position=${expected})
          AND (${allowTrailer} OR s.position NOT LIKE 'TRAILER-%')
          AND NOT EXISTS (SELECT 1 FROM occupied)
        RETURNING p.*,s.position AS previous_position
      )
      SELECT (SELECT to_jsonb(m) FROM moved m) AS moved,
        (SELECT position FROM source) AS position,(SELECT id FROM occupied) AS occupant
    `
  ]);
  if (!row.moved) {
    if (row.occupant) return {status:409,error:'Posición ocupada o apartada. La tarima conserva su ubicación.'};
    if (row.position) return {status:409,error:'La tarima cambió de posición o está en el tráiler. Actualiza el mapa.'};
    return {status:404,error:'Tarima no disponible.'};
  }
  const pallet = row.moved;
  try {
    await sql`
      INSERT INTO warehouse_map_movements (slot_id,lot_id,caliber,class_name,kilos,movement_type,user_id,user_name,notes,moved_at)
      VALUES (${target},${pallet.lot_id},${pallet.caliber},${pallet.class_name},${pallet.total_kg},
        ${target===floor?'clear':'assign'},${user?.id ?? null},${user?.name ?? null},
        ${`${pallet.folio_tarima || pallet.id}: ${pallet.previous_position} → ${palletPosition(pallet)}`},NOW())
    `;
  } catch (error) { console.error('Bitácora de movimiento de tarima:',error.message); }
  return {status:200,data:pallet};
}
