import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Dashboard de Contado - Control integral de kilogramos y trazabilidad
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const producer = searchParams.get('producer') || '';
    const customer = searchParams.get('customer') || '';
    const broker = searchParams.get('broker') || '';

    // Build WHERE clauses
    let lotWhere = sql`WHERE l.date >= ${startDate} AND l.date <= ${endDate}`;
    if (producer) {
      lotWhere = sql`${lotWhere} AND l.producer ILIKE ${'%' + producer + '%'}`;
    }
    if (broker) {
      lotWhere = sql`${lotWhere} AND l.broker_name ILIKE ${'%' + broker + '%'}`;
    }

    let loadWhere = sql`WHERE lh.load_date >= ${startDate} AND lh.load_date <= ${endDate}`;
    if (customer) {
      loadWhere = sql`${loadWhere} AND lh.customer_name ILIKE ${'%' + customer + '%'}`;
    }

    // 1. KG RECIBIDOS
    const [kgRecibidos] = await sql`
      SELECT COALESCE(SUM(fiw.total_kg_weighed), 0) as total
      FROM fruit_input_weighings fiw
      JOIN lots l ON fiw.lot_id = l.id
      ${lotWhere}
    `;

    // 2. KG PROCESADOS (empacados)
    const [kgProcesados] = await sql`
      SELECT COALESCE(SUM(psd.total_kg), 0) as total
      FROM production_selection_details psd
      JOIN production_batches pb ON psd.production_batch_id = pb.id
      JOIN lots l ON pb.lot_id = l.id
      ${lotWhere}
    `;

    // 3. KG VENDIDOS (empacado + proceso + desecho)
    const [kgVendidosEmpacado] = await sql`
      SELECT COALESCE(SUM(lh.total_kg), 0) as total
      FROM load_history lh
      ${loadWhere}
    `;

    const [kgVendidosProceso] = await sql`
      SELECT COALESCE(SUM(s.process_kg), 0) as total
      FROM sales_of_process_and_waste s
      JOIN lots l ON s.lot_id = l.id
      ${lotWhere}
    `;

    const [kgVendidosDesecho] = await sql`
      SELECT COALESCE(SUM(s.waste_kg), 0) as total
      FROM sales_of_process_and_waste s
      JOIN lots l ON s.lot_id = l.id
      ${lotWhere}
    `;

    const kgVendidosTotal = parseFloat(kgVendidosEmpacado.total || 0) + 
                            parseFloat(kgVendidosProceso.total || 0) + 
                            parseFloat(kgVendidosDesecho.total || 0);

    // 4. KG DESECHO
    const [kgDesecho] = await sql`
      SELECT COALESCE(SUM(pb.total_kg_waste), 0) as total
      FROM production_batches pb
      JOIN lots l ON pb.lot_id = l.id
      ${lotWhere}
    `;

    // 5. INGRESO GENERADO
    const [ingresoEmpacado] = await sql`
      SELECT COALESCE(SUM(lh.total_amount), 0) as total
      FROM load_history lh
      ${loadWhere}
    `;

    const [ingresoProceso] = await sql`
      SELECT COALESCE(SUM(s.total_price), 0) as total
      FROM sales_of_process_and_waste s
      JOIN lots l ON s.lot_id = l.id
      ${lotWhere}
      AND s.process_kg > 0
    `;

    const [ingresoDesecho] = await sql`
      SELECT COALESCE(SUM(s.total_price), 0) as total
      FROM sales_of_process_and_waste s
      JOIN lots l ON s.lot_id = l.id
      ${lotWhere}
      AND s.waste_kg > 0
    `;

    const ingresoTotal = parseFloat(ingresoEmpacado.total || 0) + 
                        parseFloat(ingresoProceso.total || 0) + 
                        parseFloat(ingresoDesecho.total || 0);

    // 6. PRODUCCIÓN (valor generado)
    const produccionKg = parseFloat(kgProcesados.total || 0);
    const produccionValor = parseFloat(ingresoEmpacado.total || 0);

    // 7. VENTAS
    const ventasKg = kgVendidosTotal;
    const ventasMonto = ingresoTotal;

    // 8. DESECHO (valor perdido estimado)
    const desechoKg = parseFloat(kgDesecho.total || 0);
    const desechoValorPerdido = desechoKg * 5; // $5 MXN por kg estimado

    // 9. RECUPERACIÓN (subproductos vendidos)
    const recuperacionKg = parseFloat(kgVendidosDesecho.total || 0);
    const recuperacionIngreso = parseFloat(ingresoDesecho.total || 0);

    // 10. COMPARATIVOS (semana anterior, mes anterior)
    const semanaAnteriorStart = new Date(startDate);
    semanaAnteriorStart.setDate(semanaAnteriorStart.getDate() - 7);
    const semanaAnteriorEnd = new Date(endDate);
    semanaAnteriorEnd.setDate(semanaAnteriorEnd.getDate() - 7);

    const [semanaAnterior] = await sql`
      SELECT COALESCE(SUM(lh.total_amount), 0) as total
      FROM load_history lh
      WHERE lh.load_date >= ${semanaAnteriorStart.toISOString().split('T')[0]}
      AND lh.load_date <= ${semanaAnteriorEnd.toISOString().split('T')[0]}
    `;

    const semanaComparativo = semanaAnterior.total > 0 
      ? ((ingresoTotal - parseFloat(semanaAnterior.total)) / parseFloat(semanaAnterior.total)) * 100
      : 0;

    // 11. TOP PERFORMERS
    const topProfitableLots = await sql`
      SELECT 
        l.lot_number,
        (COALESCE(SUM(lh.total_amount), 0) - (l.fruit_price * COALESCE(SUM(fiw.total_kg_weighed), 0))) as profit
      FROM lots l
      LEFT JOIN load_history lh ON lh.master_batch_id = l.id
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      WHERE l.date >= ${startDate} AND l.date <= ${endDate}
      GROUP BY l.id, l.lot_number, l.fruit_price
      ORDER BY profit DESC
      LIMIT 5
    `;

    const topPerformanceLots = await sql`
      SELECT 
        l.lot_number,
        CASE 
          WHEN COALESCE(SUM(fiw.total_kg_weighed), 0) > 0 
          THEN (COALESCE(SUM(psd.total_kg), 0) / COALESCE(SUM(fiw.total_kg_weighed), 0)) * 100
          ELSE 0
        END as performance
      FROM lots l
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      LEFT JOIN production_batches pb ON pb.lot_id = l.id
      LEFT JOIN production_selection_details psd ON psd.production_batch_id = pb.id
      WHERE l.date >= ${startDate} AND l.date <= ${endDate}
      GROUP BY l.id, l.lot_number
      ORDER BY performance DESC
      LIMIT 5
    `;

    const topVolumeLots = await sql`
      SELECT 
        l.lot_number,
        COALESCE(SUM(fiw.total_kg_weighed), 0) as volume
      FROM lots l
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      WHERE l.date >= ${startDate} AND l.date <= ${endDate}
      GROUP BY l.id, l.lot_number
      ORDER BY volume DESC
      LIMIT 5
    `;

    return NextResponse.json({
      kg_recibidos: parseFloat(kgRecibidos.total || 0),
      kg_procesados: produccionKg,
      kg_vendidos: ventasKg,
      kg_desecho: desechoKg,
      ingreso_generado: ingresoTotal,
      produccion_kg: produccionKg,
      produccion_valor: produccionValor,
      ventas_kg: ventasKg,
      ventas_monto: ventasMonto,
      desecho_kg: desechoKg,
      desecho_valor_perdido: desechoValorPerdido,
      recuperacion_kg: recuperacionKg,
      recuperacion_ingreso: recuperacionIngreso,
      semana_total: ingresoTotal,
      semana_comparativo: semanaComparativo,
      mes_total: ingresoTotal,
      mes_comparativo: 0,
      anio_total: ingresoTotal,
      top_profitable_lots: topProfitableLots.map(l => ({
        lot_number: l.lot_number,
        profit: parseFloat(l.profit || 0)
      })),
      top_performance_lots: topPerformanceLots.map(l => ({
        lot_number: l.lot_number,
        performance: parseFloat(l.performance || 0).toFixed(1)
      })),
      top_volume_lots: topVolumeLots.map(l => ({
        lot_number: l.lot_number,
        volume: parseFloat(l.volume || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching contado dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
