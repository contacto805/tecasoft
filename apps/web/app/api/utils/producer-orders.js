import sql from "@/app/api/utils/sql";

export async function findProducerOrder(producerName, folio) {
  const [order] = await sql`
    SELECT id, folio, lot_id, producer_name, orchard_name, cutting_date, net_weight,
           gross_weight, agreed_price_per_kg, plazo_dias
    FROM cutting_orders
    WHERE upper(btrim(folio)) = upper(btrim(${folio}))
      AND lower(btrim(producer_name)) = lower(btrim(${producerName}))
    LIMIT 1
  `;
  return order;
}

export async function listProducerOrders(producerName) {
  return sql`
    SELECT folio, orchard_name FROM cutting_orders
    WHERE lower(btrim(producer_name)) = lower(btrim(${producerName}))
    ORDER BY cutting_date DESC NULLS LAST, id DESC LIMIT 100
  `;
}

export async function getProducerOrderDetails(order) {
  const [paymentInfo] = await sql`
    SELECT id, status, scheduled_payment_date, payment_days
    FROM payment_schedule
    WHERE cutting_order_id = ${order.id}
      AND lower(btrim(producer_name)) = lower(btrim(${order.producer_name}))
    ORDER BY id DESC LIMIT 1
  `;
  const docs = await sql`
    SELECT document_type, status FROM payment_documents
    WHERE is_active = true AND (
      (module_origin = 'portal-productor' AND observations = ${producerDocumentReference(order)})
      OR (module_origin = 'portal-productor' AND observations = ${`Orden ${order.folio} - Productor ${order.producer_name || ''} - Folio: ${order.folio}`})
      OR (${paymentInfo?.id ?? null}::bigint IS NOT NULL AND payment_id = ${paymentInfo?.id ?? null})
    )
    ORDER BY id DESC
  `.catch(error => {
    console.error("No se pudieron consultar los documentos del productor:", error.message);
    return [];
  });
  const { id, lot_id, ...visibleOrder } = order;
  return { order: { ...visibleOrder, hasContract: !!lot_id }, paymentInfo, docs };
}

export const producerDocumentReference = order => "Portal Productores · Orden ID " + order.id;
