import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

import {withLiveClosing} from "@/app/api/utils/weekly-summary";
import {closingWeek,dateKey} from "@/utils/closing-period";

// Compatibilidad con versiones anteriores. Los datos vivos se leen desde los módulos de origen.
export async function POST(request) {
  const {addCarga} = await request.json();
  if (!addCarga) return NextResponse.json({error:"Solicitud inválida."},{status:400});
  return NextResponse.json({success:true,origen:"consulta_en_vivo"});
}

// GET - Obtener cierres semanales (solo para administración)
// XII: Usa RECEPCIONES CONFIRMADAS (fruit_input_weighings), PRODUCCIÓN CONFIRMADA (batches status CONFIRMADO),
//      MOVIMIENTOS inventario (pallet_output_summary), EMBARQUES CONFIRMADOS (load_history).
// Por fecha real de cada módulo. No replica registros. Diferencias por traspaso: no embarcado = inventario (no merma).
// Corte por rango (dateFrom/dateTo). Per-lot: recibido, producido A/B, Proceso/Desecho/Merma, transferido, embarcado, saldo.
// Costos de corte/fletes vienen de Cuadrillas/Fletes (no se recalculan aquí).
export async function GET(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
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
      return NextResponse.json(closing ? await withLiveClosing(closing) : null);
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

    const {start,end} = closingWeek();
    if (!status && !dateFrom && !dateTo) {
      const current = closings.findIndex(c => dateKey(c.week_start_date) === start && dateKey(c.week_end_date) === end);
      const active = current < 0 ? {week_start_date:start,week_end_date:end,week_label:`Semana ${start}`,
        status:'abierto',virtual:true} : closings.splice(current,1)[0];
      closings.unshift(await withLiveClosing(active));
    }
    // Enriquecer con metadatos de actualización y estado (sin reescribir históricos)
    const closingsEnriquecidos = closings.map(c => {
      const st = (c.status || 'pendiente').toLowerCase();
      let estadoDisplay = st.includes('aprob') ? 'aprobado' : (st.includes('pend') ? 'pendiente' : st);
      return {
        ...c,
        ultima_actualizacion: c.updated_at || c.created_at,
        origen: c.updated_from_embarque ? 'embarque_sync' : 'sistema',
        estado: estadoDisplay,
        fuente: 'weekly_closings (snapshot + ajustes posteriores conservados)'
      };
    });

    // Calcular comparativos
    const comparatives = [];
    for (let i = 0; i < Math.min(closingsEnriquecidos.length, 10); i++) {
      const current = closingsEnriquecidos[i];
      const previous = closingsEnriquecidos[i + 1];
      
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

    // Reconciliación automática por lote: marca explícitamente "Pendiente" / "Estimado" cuando no hay confirmación total
    const lotYieldSummaryEnriquecido = lotYieldSummary.map(row => ({
      ...row,
      saldo_estado: row.saldo_estimado > 0 ? 'Estimado (no embarcado completo)' : (row.embarcado_kg > 0 ? 'Conciliado' : 'Pendiente'),
      origen_dato: 'fruit_input_weighings + production_batches(CONFIRMADO) + load_history + pallet_output_summary',
      ultima_actualizacion: row.ultima_actualizacion || new Date().toISOString(),
      fuente: 'reconciliacion_automatica_sin_doble_asiento'
    }));

    // FASE 03: Valor inventario materiales (fuente única, no duplica gastos)
    let invMateriales = { valor: 0, unidades: 0 };
    try {
      const { getInventarioMaterialesValor } = await import('@/app/api/utils/recalculate');
      invMateriales = await getInventarioMaterialesValor();
    } catch(_) {}

    return NextResponse.json({ 
      closings: closingsEnriquecidos, 
      comparatives, 
      lotYieldSummary: lotYieldSummaryEnriquecido,
      inventario_materiales: invMateriales,
      meta: {
        ultima_actualizacion: new Date().toISOString(),
        origen: 'consultas_confirmadas',
        estado: 'datos_actualizados_con_estado_y_origen',
        nota: 'Cierres autorizados no son reescritos. Saldos estimados marcados como Pendiente/Estimado. Inventario materiales desde materials_inventory (único).'
      }
    });
  } catch (error) {
    console.error('Error fetching weekly closings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Aprobar/Rechazar/Reabrir cierre semanal
export async function PUT(request) {
  try {
    if (!await getVerifiedErpUser()) return NextResponse.json({error:"Inicia sesión en Tecavo Soft."},{status:401});
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
