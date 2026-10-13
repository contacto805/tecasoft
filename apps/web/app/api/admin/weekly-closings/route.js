import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST: auto-sync desde Embarques (nota de venta totals to weekly closing) - instant reflect
export async function POST(request) {
  try {
    const body = await request.json();
    const { addCarga, load_date, factura_folio, total_kg, total_amount, customer_name, notes } = body;

    if (!addCarga) {
      return NextResponse.json({ error: "use {addCarga:true, ...}" }, { status: 400 });
    }

    const d = load_date ? new Date(load_date) : new Date();
    // Compute week start (monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    weekStart.setHours(0,0,0,0);
    const weekStartStr = weekStart.toISOString().slice(0,10);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0,10);
    const weekLabel = `Semana ${weekStartStr} - ${weekEndStr}`;

    // Find or insert current week closing
    let [closing] = await sql`
      SELECT * FROM weekly_closings 
      WHERE week_start_date = ${weekStartStr} 
      LIMIT 1
    `;
    if (!closing) {
      const inserted = await sql`
        INSERT INTO weekly_closings (
          week_start_date, week_end_date, week_label, 
          total_cargas_kg, total_cargas_dinero, total_cargas,
          status, created_at, updated_at
        ) VALUES (
          ${weekStartStr}, ${weekEndStr}, ${weekLabel}, 
          0, 0, 0, 'pendiente', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *
      `;
      closing = inserted[0];
    }

    // Increment kg + dinero + store detail
    const newKg = (parseFloat(closing.total_cargas_kg || 0) + parseFloat(total_kg || 0));
    const newDin = (parseFloat(closing.total_cargas_dinero || 0) + parseFloat(total_amount || 0));

    let newDetalle = [];
    try { 
      newDetalle = Array.isArray(closing.cargas_detalle) ? closing.cargas_detalle : JSON.parse(closing.cargas_detalle || "[]"); 
    } catch(e){ newDetalle = []; }
    newDetalle.push({ 
      fecha: load_date || new Date().toISOString().slice(0,10),
      folio: factura_folio || 'sin-folio',
      total_kg: parseFloat(total_kg||0),
      total_amount: parseFloat(total_amount||0),
      customer: customer_name || ''
    });

    await sql`
      UPDATE weekly_closings 
      SET 
        total_cargas_kg = ${newKg},
        total_cargas_dinero = ${newDin},
        total_cargas = COALESCE(total_cargas,0) + 1,
        cargas_detalle = ${JSON.stringify(newDetalle)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${closing.id}
    `;

    return NextResponse.json({ success: true, week_label: weekLabel, updated_kg: newKg, updated_dinero: newDin });
  } catch (error) {
    console.error("Error POST weekly-closings carga sync:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Obtener cierres semanales (solo para administración)
// XII: Usa RECEPCIONES CONFIRMADAS (fruit_input_weighings), PRODUCCIÓN CONFIRMADA (batches status CONFIRMADO),
//      MOVIMIENTOS inventario (pallet_output_summary), EMBARQUES CONFIRMADOS (load_history).
// Por fecha real de cada módulo. No replica registros. Diferencias por traspaso: no embarcado = inventario (no merma).
// Corte por rango (dateFrom/dateTo). Per-lot: recibido, producido A/B, Proceso/Desecho/Merma, transferido, embarcado, saldo.
// Costos de corte/fletes vienen de Cuadrillas/Fletes (no se recalculan aquí).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const id = searchParams.get('id');
    const perLot = searchParams.get('perLot') === 'true';
    const lotIdFilter = searchParams.get('lotId');

    // Si se solicita un cierre específico
    if (id) {
      const [closing] = await sql`
        SELECT * FROM weekly_closings WHERE id = ${parseInt(id)}
      `;
      return NextResponse.json(closing || null);
    }

    let where = sql`WHERE 1=1`;

    if (status) {
      where = sql`${where} AND status = ${status}`;
    }
    if (dateFrom && dateTo) {
      where = sql`${where} AND week_start_date >= ${dateFrom} AND week_end_date <= ${dateTo}`;
    }

    const closings = await sql`
      SELECT * FROM weekly_closings
      ${where}
      ORDER BY week_start_date DESC
      LIMIT 100
    `;

    // Calcular comparativos
    const comparatives = [];
    for (let i = 0; i < Math.min(closings.length, 10); i++) {
      const current = closings[i];
      const previous = closings[i + 1];
      
      if (previous) {
        comparatives.push({
          week: current.week_label,
          ingresos: parseFloat(current.total_ingresos_dinero || 0),
          egresos: parseFloat(current.total_egresos_dinero || 0),
          utilidad: parseFloat(current.resultado_dinero || 0),
          variacion: parseFloat(current.resultado_dinero || 0) - parseFloat(previous.resultado_dinero || 0)
        });
      }
    }

    // XII: Datos confirmados por fuente real (solo lectura, sin side effects)
    let lotYieldSummary = [];
    if (perLot || lotIdFilter) {
      const lotWhere = lotIdFilter ? sql`AND l.id = ${parseInt(lotIdFilter)}` : sql``;
      lotYieldSummary = await sql`
        SELECT 
          l.id as lot_id,
          l.lot_number,
          l.producer,
          COALESCE(fiw.total_kg_weighed, 0) as recibido_kg,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN psd.total_kg ELSE 0 END), 0) as producido_kg,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' AND psd.class_name IN ('A','SUPER','EXTRA','PRIMERA') THEN psd.total_kg ELSE 0 END), 0) as producido_clase_a,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' AND psd.class_name = 'B' THEN psd.total_kg ELSE 0 END), 0) as producido_clase_b,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN pb.process_kg ELSE 0 END), 0) as proceso_kg,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN pb.desecho_kg ELSE 0 END), 0) as desecho_kg,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN pb.merma_kg ELSE 0 END), 0) as merma_kg,
          COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN 1 ELSE 0 END), 0) as corridas_confirmadas,
          COALESCE((
            SELECT SUM(total_kg) FROM pallet_output_summary pos 
            WHERE pos.lot_id = l.id AND (pos.embarque_id IS NULL OR pos.estado != 'embarcado')
          ), 0) as en_inventario_kg,
          COALESCE((
            SELECT SUM(ld.total_kg) FROM load_details ld 
            JOIN load_history lh2 ON lh2.id = ld.load_id 
            WHERE ld.lot_id = l.id 
          ), 0) as embarcado_kg,
          (COALESCE(fiw.total_kg_weighed, 0) 
           - COALESCE(SUM(CASE WHEN pb.status = 'CONFIRMADO' THEN psd.total_kg ELSE 0 END), 0)
           - COALESCE((
               SELECT SUM(ld.total_kg) FROM load_details ld 
               JOIN load_history lh2 ON lh2.id = ld.load_id 
               WHERE ld.lot_id = l.id 
             ), 0)
          ) as saldo_estimado,
          MAX(pb.updated_at) as ultima_actualizacion
        FROM lots l
        LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
        LEFT JOIN production_batches pb ON pb.lot_id = l.id
        LEFT JOIN production_selection_details psd ON psd.production_batch_id = pb.id
        WHERE 1=1 ${lotWhere}
        GROUP BY l.id, l.lot_number, l.producer, fiw.total_kg_weighed
        ORDER BY l.lot_number DESC
        LIMIT 50
      `;
    }

    return NextResponse.json({ closings, comparatives, lotYieldSummary });
  } catch (error) {
    console.error('Error fetching weekly closings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Aprobar/Rechazar/Reabrir cierre semanal
export async function PUT(request) {
  try {
    const { id, action, userId, notes } = await request.json();

    if (!id || !action || !userId) {
      return NextResponse.json(
        { error: 'id, action y userId son requeridos' },
        { status: 400 }
      );
    }

    if (!['aprobar', 'rechazar', 'reabrir'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser "aprobar", "rechazar" o "reabrir"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'aprobar' ? 'aprobado' : action === 'rechazar' ? 'rechazado' : 'pendiente';

    const [result] = await sql`
      UPDATE weekly_closings
      SET 
        status = ${newStatus},
        notes = ${notes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Cierre no encontrado' },
        { status: 404 }
      );
    }

    // Registrar en bitácora
    await sql`
      INSERT INTO system_audit_log (
        user_id,
        user_name,
        module,
        action,
        entity_type,
        entity_id,
        description,
        status
      )
      VALUES (
        ${userId},
        ${userId},
        'cierres_semanales',
        ${action},
        'weekly_closing',
        ${result.id},
        ${`Cierre ${result.week_label} ${action === 'aprobar' ? 'aprobado' : action === 'rechazar' ? 'rechazado' : 'reabierto'}`},
        'exitoso'
      )
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating weekly closing:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
