export const coldSlots = Array.from({length:13},(_,i)=>['A','B','C'].map(c=>c+'-'+(i+1))).flat();
export const coldSlotPattern = /^[ABC]-(?:[1-9]|1[0-3])$/;
export const trailerSlotPattern = /^TRAILER-(?:0[1-9]|1\d|2[0-8])$/;
export const floor = 'PISO';
const inactive = ['EMBARCADA','CANCELADA','REEMPACADA'];

export function trailerPosition(index) {
  return 'TRAILER-' + String((index % 14) * 2 + (index < 14 ? 1 : 2)).padStart(2,'0');
}

export function palletPosition(pallet) {
  const current = String(pallet.ubicacion_actual || '').trim().toUpperCase();
  const cold = String(pallet.warehouse_slot || '').trim().toUpperCase();
  if (trailerSlotPattern.test(current) || coldSlotPattern.test(current)) return current;
  return coldSlotPattern.test(cold) ? cold : floor;
}

export function makeShipmentMap(rows) {
  const warehouse = {}, reserved = {}, pending = [], trailer = Array(28).fill(null), conflicts = [];
  for (const row of rows) {
    if (row.embarque_id || inactive.includes(String(row.estado || '').toUpperCase())) continue;
    const position = palletPosition(row);
    const origin = trailerSlotPattern.test(position) && coldSlotPattern.test(String(row.warehouse_slot || '').toUpperCase())
      ? row.warehouse_slot.toUpperCase() : null;
    const pallet = {
      uid:'tar-' + row.id, originalPalletId:row.id, position, origin,
      folio:row.folio_tarima || 'TAR-' + row.id, lot_number:row.lot_number || 'Sin lote',
      lot_id:row.lot_id, caliber:row.caliber || 'Sin calibre', class_name:row.class_name || '',
      boxes:Number(row.total_boxes || row.boxes_count || 0) || (Number(row.pallet_count) || 1) *
        (String(row.pallet_type || '').includes('6') ? 40 : 96),
      kilos:Number(row.total_kg || 0), cold_date:String(row.cold_date || '').slice(0,10),
      estado:row.estado,
    };
    if (origin) reserved[origin] = pallet;
    if (coldSlotPattern.test(position)) {
      if (warehouse[position]) conflicts.push(position);
      else warehouse[position] = pallet;
    } else if (trailerSlotPattern.test(position)) {
      const index = trailer.findIndex((_,i)=>trailerPosition(i) === position);
      if (trailer[index]) conflicts.push(position);
      else trailer[index] = pallet;
    } else pending.push(pallet);
  }
  return {warehouse,reserved,pending,trailer,conflicts};
}
