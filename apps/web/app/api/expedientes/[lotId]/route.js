import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { lotId } = await params;
    const id = parseInt(lotId);

    if (!id) return NextResponse.json({ error: "Lote requerido" }, { status: 400 });

    // Core lot + receives / weighings info
    const [lot] = await sql`
      SELECT 
        l.*,
        COALESCE(fiw.total_kg_weighed, l.total_kg_received) as kg_recibidos_real,
        fiw.public_scale_date,
        fiw.reception_responsible,
        fiw.notes as fiw_notes,
        fiw.total_kg_weighed as nota_kg
      FROM lots l
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      WHERE l.id = ${id}
    `;

    if (!lot) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

    // Weighings / pesajes
    const pesajes = await sql`
      SELECT id, boxes, gross_weight, net_weight, with_pallet, tare_weight, timestamp, photo_url
      FROM weighings 
      WHERE lot_id = ${id} 
      ORDER BY timestamp ASC
    `;

    // Classifications / lotification data (hist + registry)
    const lotificacion = await sql`
      SELECT * FROM lotification_registry 
      WHERE lot_id = ${id}
      ORDER BY created_at DESC LIMIT 3
    `;

    const historial = await sql`
      SELECT * FROM historial_lotes 
      WHERE lot_id = ${id}
      ORDER BY fecha DESC, created_at DESC LIMIT 15
    `;

    // Payment data
    const [pago] = await sql`
      SELECT * FROM payment_schedule 
      WHERE lot_id = ${id}
      ORDER BY created_at DESC LIMIT 1
    `;

    // Documents for accountant + payment docs
    const docsContador = await sql`
      SELECT * FROM lot_accountant_documents
      WHERE lot_id = ${id}
      ORDER BY uploaded_at DESC
    `;

    const docsPago = await sql`
      SELECT * FROM payment_documents 
      WHERE (provider_id = ${lot.id} OR module_origin ILIKE '%contador%' OR payment_id IN (SELECT id FROM payment_schedule WHERE lot_id = ${id}))
      ORDER BY upload_date DESC
    `;

    // Nota entrada summary
    const notaEntrada = lot.nota_kg ? { 
      total_kg: lot.nota_kg,
      public_scale_date: lot.public_scale_date,
      reception_responsible: lot.reception_responsible 
    } : null;

    // Photo gallery (if any) — use visit_photos or weighings photo + production ones
    const fotos = await sql`
      SELECT photo_url, photo_type as tipo, captured_at as fecha
      FROM visit_photos
      WHERE visit_id IN (SELECT id FROM orchard_visits WHERE producer = ${lot.producer} LIMIT 1)
      LIMIT 8
      UNION
      SELECT photo_url, 'pesaje'::text as tipo, timestamp::text as fecha FROM weighings WHERE lot_id = ${id} AND photo_url IS NOT NULL
      LIMIT 8
    `;

    // Computed states
    const estado_pago = pago ? pago.status : 'pendiente';
    const estado_documentos = (docsContador.length + docsPago.length) >= 4 ? "completa" : (docsContador.length + docsPago.length > 0) ? "parcial" : "pendiente";
    const estado_expediente = (lot.kg_recibidos_real > 0 && docsContador.length > 0) ? (estado_pago === 'pagado' ? 'cerrado' : 'en_revision') : 'pendiente';

    // Contrato firmado DocuSign (última firma del lote)
    const [contractSig] = await sql`
      SELECT id, status, signer_name, signer_email, signed_at, signed_file_url, envelope_status
      FROM lot_contract_signatures 
      WHERE lot_id = ${id}
      ORDER BY created_at DESC LIMIT 1
    `;

    return NextResponse.json({
      lote: {
        ...lot,
        kg_recibidos: lot.kg_recibidos_real || lot.total_kg_received
      },
      pesajes,
      lotificacion: lotificacion.length ? lotificacion[0] : null,
      historial,
      pago: pago || null,
      documentos: [...docsContador, ...docsPago],
      fotos,
      nota_entrada: notaEntrada,
      estados: {
        expediente: estado_expediente,
        documentos: estado_documentos,
        pago: estado_pago,
        fecha_programada_pago: pago?.scheduled_payment_date || lot.payment_scheduled_date || null
      },
      contrato: {
        disponible: true,
        url: `/api/lots/${id}/contract`,
        signature: contractSig || null
      }
    });
  } catch (error) {
    console.error("Error EXPEDIENTE detail:", error);
    return NextResponse.json({ error: "Error cargando expediente" }, { status: 500 });
  }
}
