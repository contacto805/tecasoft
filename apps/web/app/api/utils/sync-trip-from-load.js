import sql from "@/app/api/utils/sql";

export async function syncCommercialTripFromLoad(id,operator='sistema') {
  if (!/^\d+$/.test(String(id))) return {skipped:true};
  const [, [result]] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext('tecavo-shipment-commercial-trip'))`,
    sql`
      WITH selected AS (
        SELECT * FROM load_history WHERE id=${id} AND customer_id IS NOT NULL
      ), related AS (
        SELECT h.* FROM load_history h JOIN selected s ON h.customer_id=s.customer_id
         AND (h.id=s.id OR (NULLIF(s.factura_folio,'') IS NOT NULL AND h.factura_folio=s.factura_folio))
      ), totals AS (
        SELECT min(id) AS anchor,COALESCE(SUM(total_kg),0) AS kg,COALESCE(SUM(boxes_count),0) AS boxes,
          COALESCE(SUM(total_amount),0) AS native_amount FROM related HAVING COUNT(*)>0
      ), data AS (
        SELECT h.*, t.kg,t.boxes,t.native_amount,
          COALESCE(n.importe_original_usd,CASE WHEN h.currency='USD' THEN t.native_amount END) AS amount_usd
        FROM totals t JOIN related h ON h.id=t.anchor
        LEFT JOIN notas n ON n.customer_id=h.customer_id AND n.folio=h.factura_folio
      ), prior AS (
        SELECT v.id FROM viajes v JOIN related h ON h.id=v.load_history_id
        ORDER BY v.id LIMIT 1
      ), updated AS (
        UPDATE viajes v SET numero_cajas=d.boxes,peso=d.kg,valor_usd=d.amount_usd,
          updated_by=${operator},updated_at=NOW()
        FROM data d,prior p WHERE v.id=p.id RETURNING v.id
      ), created AS (
        INSERT INTO viajes(folio,fecha_salida,customer_id,destino,transportista,placas,
          numero_cajas,peso,valor_usd,estatus,observaciones,created_by,load_history_id,numero_carga,referencia_interna)
        SELECT 'V-'||LPAD((COALESCE((SELECT MAX(substring(folio FROM 3)::bigint) FROM viajes
          WHERE folio ~ '^V-[0-9]{1,12}$'),0)+1)::text,6,'0'),d.load_date,d.customer_id,d.destination,
          d.driver_name,d.truck_plates,d.boxes,d.kg,d.amount_usd,'Confirmado',d.notes,
          ${operator},d.id,d.factura_folio,'Carga-'||d.id
        FROM data d WHERE NOT EXISTS(SELECT 1 FROM prior) RETURNING id
      ), trip AS (SELECT id FROM updated UNION ALL SELECT id FROM created),
      note AS (
        UPDATE notas n SET viaje_id=t.id FROM trip t,data d
        WHERE n.customer_id=d.customer_id AND n.folio=d.factura_folio RETURNING n.id
      ), update_compat AS (
        UPDATE customer_trips ct SET total_kg=d.kg,boxes_count=d.boxes,
          price_per_trip=d.native_amount,currency=d.currency
        FROM data d WHERE ct.load_history_id=d.id RETURNING ct.id
      ), insert_compat AS (
        INSERT INTO customer_trips(customer_id,load_history_id,trip_date,total_kg,boxes_count,
         price_per_trip,currency,status,notes)
        SELECT d.customer_id,d.id,d.load_date,d.kg,d.boxes,d.native_amount,d.currency,'activo',d.notes
        FROM data d WHERE NOT EXISTS (SELECT 1 FROM update_compat) RETURNING id
      )
      SELECT (SELECT id FROM trip) AS viaje_id,(SELECT id FROM note LIMIT 1) AS nota_id
    `
  ]);
  return result.viaje_id ? {viajeId:result.viaje_id,notaId:result.nota_id} : {skipped:true};
}
