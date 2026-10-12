import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Admin list view for Expedientes (Superadmin + Encargado de Administracion only)
// Joins lots + weighings/fr input + payment_schedule + doc stats

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const estadoPago = searchParams.get("estado_pago") || "";

    // Base lots with related data + computed estado
    const rows = await sql`
      SELECT 
        l.id,
        l.lot_number,
        l.lot_number as folio_ingreso,
        l.producer,
        l.orchard_name as huerta,
        l.date as fecha_ingreso,
        COALESCE(fiw.total_kg_weighed, l.total_kg_received, 0) as kg_recibidos,
        l.status as expediente_estado_base,
        l.accountant_code,
        l.payment_scheduled_date as fecha_programada_pago,
        COALESCE(ps.status, 'pendiente') as estado_pago,
        ps.scheduled_payment_date as fecha_programada_pago_real,
        COALESCE((
          SELECT COUNT(*) FROM lot_accountant_documents lad WHERE lad.lot_id = l.id
        ),0) + COALESCE((
          SELECT COUNT(*) FROM payment_documents pd WHERE pd.provider_id = l.id OR (pd.module_origin = 'contador_upload')
        ),0) as num_docs
      FROM lots l
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      LEFT JOIN payment_schedule ps ON ps.lot_id = l.id
      WHERE 1=1
        ${search ? sql`AND (l.lot_number ILIKE ${'%' + search + '%'} OR l.producer ILIKE ${'%' + search + '%'} OR l.orchard_name ILIKE ${'%' + search + '%'})` : sql``}
        ${estadoPago ? sql`AND COALESCE(ps.status, 'pendiente') = ${estadoPago}` : sql``}
      ORDER BY l.date DESC, l.id DESC
      LIMIT 200
    `;

    const items = rows.map(r => {
      const docs = parseInt(r.num_docs || 0);
      let estado_documentos = "pendiente";
      if (docs >= 5) estado_documentos = "completa";
      else if (docs > 0) estado_documentos = "parcial";

      // simple expediente status
      let estado_expediente = "En Proceso";
      if (r.kg_recibidos > 0 && docs > 0 && (r.estado_pago === "pagado" || r.estado_pago === "paid")) {
        estado_expediente = "Cerrado";
      } else if (r.kg_recibidos > 0) {
        estado_expediente = "En Revisión";
      }

      return {
        id: r.id,
        lot_number: r.lot_number,
        folio_ingreso: r.folio_ingreso || r.lot_number,
        producer: r.producer,
        huerta: r.huerta,
        fecha_ingreso: r.fecha_ingreso,
        kg_recibidos: parseFloat(r.kg_recibidos || 0),
        estado_expediente,
        estado_documentos,
        num_docs: docs,
        estado_pago: r.estado_pago || 'pendiente',
        fecha_programada_pago: r.fecha_programada_pago || r.fecha_programada_pago_real || null,
        accountant_code: r.accountant_code || null
      };
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error /api/expedientes GET:", error);
    return NextResponse.json({ error: "Error al cargar expedientes" }, { status: 500 });
  }
}
