import sql from "@/app/api/utils/sql";
import {NextResponse} from "next/server";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";

export async function GET(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:'Inicia sesión en Tecavo Soft.'},{status:401});
    const id = new URL(request.url).searchParams.get('loadId');
    if (!/^\d+$/.test(id || '')) return NextResponse.json({error:'ID de embarque inválido.'},{status:400});
    const [document] = await sql`
      WITH selected AS (SELECT * FROM load_history WHERE id=${id}), related AS (
        SELECT h.* FROM load_history h JOIN selected p ON h.customer_id=p.customer_id
          AND (h.id=p.id OR (NULLIF(p.factura_folio,'') IS NOT NULL AND h.factura_folio=p.factura_folio))
      ), positions AS (
        SELECT m.* FROM trailer_load_map m JOIN related r ON r.id=m.load_id
      ), details AS (
        SELECT d.*,l.lot_number FROM load_details d JOIN related r ON r.id=d.load_id
        LEFT JOIN lots l ON l.id=d.lot_id
      ), shipped AS (
        SELECT p.id,p.folio_tarima,p.cold_date,p.total_kg,p.caliber,p.class_name,p.pallet_count,p.pallet_type,
          l.lot_number, pos.slot_position, pos.boxes
        FROM pallet_output_summary p JOIN related r ON r.id=p.embarque_id
        LEFT JOIN lots l ON l.id=p.lot_id
        LEFT JOIN LATERAL(SELECT m.slot_position,m.boxes FROM positions m
          WHERE m.notes='Tarima #'||p.id ORDER BY m.id LIMIT 1) pos ON true
      )
      SELECT s.factura_folio AS folio,s.currency,s.load_date AS date,s.customer_name AS customer,
        s.driver_name AS driver,s.trailer_plates AS plates,s.destination,s.notes,
        COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM details d),'[]'::jsonb) AS rows,
        COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.unload_order) FROM positions p),'[]'::jsonb) AS positions,
        COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.slot_position,t.id) FROM shipped t),'[]'::jsonb) AS pallets,
        COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM related r),'[]'::jsonb) AS loads
      FROM selected s
    `;
    if (!document) return NextResponse.json({error:'Embarque no encontrado.'},{status:404});
    const rows = document.rows.length ? document.rows : document.loads.map(l=>({
      caliber:l.caliber,pallets:l.pallets_count,boxes:l.boxes_count,total_kg:l.total_kg,
      unit_price:l.unit_price,subtotal:l.total_amount
    }));
    return NextResponse.json({
      folio:document.folio,date:document.date,currency:document.currency,customer:document.customer,driver:document.driver,
      plates:document.plates,destination:document.destination,notes:document.notes,positions:document.positions,
      rows:rows.map(row=>({
        producto:['Aguacate',row.caliber,row.lot_number].filter(Boolean).join(' · '),
        presentacion:row.class_name || '',tarimas:row.pallets,cajas:row.boxes,kg:row.total_kg,
        precio:row.unit_price,total:row.subtotal
      })),
      pallets:document.pallets.map(p=>({
        folio:p.folio_tarima || 'Tarima #' + p.id, lot_number:p.lot_number,position:p.slot_position,
        cold_date:String(p.cold_date || '').slice(0,10), kilos:p.total_kg,caliber:p.caliber,class_name:p.class_name,
        boxes:p.boxes ?? ((Number(p.pallet_count)||1)*(String(p.pallet_type || '').includes('6') ? 40 : 96))
      }))
    },{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('Lectura de documentos de embarque:',error.message);
    return NextResponse.json({error:'No se pudo abrir el embarque.'},{status:500});
  }
}
