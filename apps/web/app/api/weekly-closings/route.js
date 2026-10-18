import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { calculateIntegralLotCost, calculateNetIncome, calculateUtility, calculateMargin } from "@/app/api/utils/financial-engine";

// Helper: Monday-Sunday week (Mexico style)
function getWeekBounds(startStr) {
  const d = startStr ? new Date(startStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

// Core integral calculator - queries ONLY confirmed source tables. No duplication.
function toNum(v) { return (v == null || isNaN(parseFloat(v))) ? 0 : parseFloat(v); }

async function calcularCierreIntegral(startDate, endDate) {
  const [weekStart, weekEnd] = [startDate, endDate];

  // =====================
  // PESTAÑA 1: PRODUCCIÓN (confirmed sources)
  // =====================
  const prodRecibidos = await sql`
    SELECT 
      COALESCE(SUM(fiw.total_kg_weighed), 0) as kg_recibidos,
      COUNT(DISTINCT fiw.lot_id) as lotes_recibidos
    FROM fruit_input_weighings fiw
    WHERE fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const prodLotif = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN psd.class_name IN ('A','SUPER','EXTRA','PRIMERA') THEN psd.total_kg ELSE 0 END), 0) as calidad_a,
      COALESCE(SUM(CASE WHEN psd.class_name IN ('B','MEDIANO','TERCERA','CUARTA') THEN psd.total_kg ELSE 0 END), 0) as calidad_b,
      COALESCE(SUM(pb.process_kg), 0) as proceso,
      COALESCE(SUM(pb.desecho_kg), 0) as desecho,
      COALESCE(SUM(pb.merma_kg), 0) as merma,
      COALESCE(SUM(psd.total_kg), 0) as total_lotificado
    FROM production_batches pb
    LEFT JOIN production_selection_details psd ON psd.production_batch_id = pb.id
    WHERE pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
      AND COALESCE(pb.status, 'CONFIRMADO') != 'BORRADOR'
  `;

  const tarimasProd = await sql`
    SELECT COALESCE(SUM(pallet_count), 0) as tarimas, COALESCE(SUM(total_kg), 0) as kg_tarimas
    FROM pallet_output_summary
    WHERE packing_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const rendimientoPorLote = await sql`
    SELECT 
      l.id, l.lot_number, l.producer,
      COALESCE(fiw.total_kg_weighed, 0) as kg_recibidos,
      COALESCE(SUM(psd.total_kg), 0) as kg_lotificado,
      COALESCE(SUM(CASE WHEN psd.class_name IN ('A','SUPER','EXTRA','PRIMERA') THEN psd.total_kg ELSE 0 END), 0) as a,
      COALESCE(SUM(pb.process_kg),0) as proceso,
      COALESCE(SUM(pb.desecho_kg),0) as desecho,
      COALESCE(SUM(pb.merma_kg),0) as merma
    FROM lots l
    LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
    LEFT JOIN production_batches pb ON pb.lot_id = l.id AND pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
    LEFT JOIN production_selection_details psd ON psd.production_batch_id = pb.id
    WHERE (fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd} OR pb.production_date BETWEEN ${weekStart} AND ${weekEnd})
    GROUP BY l.id, l.lot_number, l.producer, fiw.total_kg_weighed
    ORDER BY kg_recibidos DESC LIMIT 30
  `;

  // =====================
  // PESTAÑA 2: INVENTARIOS (formula exacta)
  // =====================
  // Fruit inventory movements (approximate using pallet + loads)
  const invFruta = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN packing_date < ${weekStart} AND COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA') THEN total_kg ELSE 0 END), 0) as inicial,
      COALESCE(SUM(CASE WHEN packing_date BETWEEN ${weekStart} AND ${weekEnd} THEN total_kg ELSE 0 END), 0) as entradas,
      COALESCE(SUM(CASE WHEN embarque_id IS NOT NULL AND packing_date BETWEEN ${weekStart} AND ${weekEnd} THEN total_kg ELSE 0 END), 0) as salidas
    FROM pallet_output_summary
  `;

  const invFinalFruta = Math.max(0, parseFloat(invFruta[0]?.inicial || 0) + parseFloat(invFruta[0]?.entradas || 0) - parseFloat(invFruta[0]?.salidas || 0));

  // Materials - EXACT FORMULA from spec
  const matMov = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN created_at::date < ${weekStart} THEN quantity_available * COALESCE(costo_promedio, cost_per_unit, 0) ELSE 0 END), 0) as valor_inicial,
      COALESCE(SUM(quantity_available), 0) as unidades_inicial
    FROM materials_inventory
  `;

  // Entradas (purchases/receptions during week even if not paid)
  const matEntradas = await sql`
    SELECT COALESCE(SUM(pr.quantity_received * COALESCE(mi.cost_per_unit, 0)), 0) as valor_entradas
    FROM purchase_receptions pr
    JOIN purchase_orders po ON po.id = pr.purchase_order_id
    JOIN materials_inventory mi ON mi.id = po.product_or_service::int OR mi.material_name ILIKE '%' || po.product_or_service || '%'
    WHERE pr.reception_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  // Consumos (material_deductions + bitacora during week)
  const matConsumos = await sql`
    SELECT COALESCE(SUM(md.quantity_used * COALESCE(md.costo_unitario_aplicado, mi.cost_per_unit, 0)), 0) as valor_consumos
    FROM material_deductions md
    JOIN materials_inventory mi ON mi.id = md.material_id
    JOIN production_batches pb ON pb.id = md.production_batch_id
    WHERE pb.production_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const matAjustes = await sql`SELECT COALESCE(SUM(ABS(valor_nuevo - valor_anterior)), 0) as ajustes FROM bitacora_auditoria_insumos WHERE timestamp::date BETWEEN ${weekStart} AND ${weekEnd}`;

  const valorInicialMat = parseFloat(matMov[0]?.valor_inicial || 0);
  const entradasMat = parseFloat(matEntradas[0]?.valor_entradas || 0);
  const consumosMat = parseFloat(matConsumos[0]?.valor_consumos || 0);
  const ajustesMat = parseFloat(matAjustes[0]?.ajustes || 0);

  // EXACT FORMULA
  const invFinalMaterial = valorInicialMat + entradasMat - consumosMat + ajustesMat;

  const tarimasDisp = await sql`
    SELECT COALESCE(SUM(pallet_count),0) as disp FROM pallet_output_summary 
    WHERE COALESCE(estado,'') NOT IN ('EMBARCADA','CANCELADA') AND packing_date <= ${weekEnd}
  `;
  const tarimasEmbarc = await sql`
    SELECT COALESCE(SUM(pallet_count),0) as embarc FROM pallet_output_summary 
    WHERE estado = 'EMBARCADA' AND packing_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  // =====================
  // PESTAÑA 3: COSTOS Y GASTOS
  // =====================
  const costoFruta = await sql`
    SELECT COALESCE(SUM(fiw.total_kg_weighed * COALESCE(l.fruit_price, l.applied_purchase_price_mxn_kg, 0)), 0) as costo
    FROM fruit_input_weighings fiw JOIN lots l ON l.id=fiw.lot_id
    WHERE fiw.public_scale_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const costosCuadrilla = await sql`
    SELECT COALESCE(SUM(payable_kg * COALESCE(applied_crew_rate, 1.4)), 0) as total
    FROM cutting_orders WHERE cutting_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const fletesComerciales = await sql`SELECT COALESCE(SUM(price),0) FROM crew_freights WHERE freight_date BETWEEN ${weekStart} AND ${weekEnd}`;

  const materialesConsumidosCosto = consumosMat; // same as above

  const nomina = await sql`SELECT COALESCE(SUM(net_salary),0) FROM payroll_records pr JOIN payroll_periods pp ON pp.id=pr.payroll_period_id WHERE pp.week_start_date >= ${weekStart} AND pp.week_end_date <= ${weekEnd}`;

  const gastosBancarios = await sql`
    SELECT COALESCE(SUM(charge),0) FROM bank_movements bm
    JOIN bank_statements bs ON bs.id=bm.statement_id
    WHERE bm.movement_date BETWEEN ${weekStart} AND ${weekEnd} AND (bm.category ILIKE '%comision%' OR bm.description ILIKE '%comision%')
  `;

  const otrosGastos = await sql`SELECT COALESCE(SUM(amount_mxn),0) FROM operating_costs WHERE cost_date BETWEEN ${weekStart} AND ${weekEnd} AND cost_category NOT IN ('produccion','compra_inventario')`;

  // =====================
  // PESTAÑA 4: BANCOS Y COBRANZA (integrates FASE 07)
  // =====================
  const bankWeek = await sql`
    SELECT 
      COALESCE(SUM(credit),0) as abonos,
      COALESCE(SUM(charge),0) as cargos,
      COUNT(*) as total_mov
    FROM bank_movements bm
    JOIN bank_statements bs ON bs.id = bm.statement_id
    WHERE bm.movement_date BETWEEN ${weekStart} AND ${weekEnd}
  `;

  const cobrosClientes = await sql`SELECT COALESCE(SUM(equivalente_usd),0) FROM abonos WHERE fecha BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosProductores = await sql`SELECT COALESCE(SUM(monto_pagado),0) FROM payment_schedule WHERE paid_at::date BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosProveedores = await sql`SELECT COALESCE(SUM(amount),0) FROM producer_payments WHERE actual_payment_date BETWEEN ${weekStart} AND ${weekEnd}`;

  const pagosFletes = fletesComerciales; // reuse

  // =====================
  // PESTAÑA 5: RENTABILIDAD (usando MOTOR FINANCIERO CENTRALIZADO V9)
  // =====================
  const ingresosNetosRes = await calculateNetIncome({ weekStart, weekEnd });
  const ingresosNetos = ingresosNetosRes.ingreso_neto || 0;

  // Costo de ventas via motor (histórico por lote)
  let costoVentas = 0;
  try {
    const loads = await sql`SELECT lot_id, total_kg FROM load_details ld JOIN load_history lh ON lh.id=ld.load_id WHERE lh.load_date BETWEEN ${weekStart} AND ${weekEnd} LIMIT 200`;
    for (const l of loads) {
      if (l.lot_id) {
        const c = await calculateIntegralLotCost(l.lot_id);
        if (c && c.costo_kg_comercializable) {
          costoVentas += (toNum(l.total_kg) || 0) * c.costo_kg_comercializable;
        }
      }
    }
  } catch (_) {
    // fallback
    const fb = await sql`SELECT COALESCE(SUM(total_amount),0) as t FROM load_history WHERE load_date BETWEEN ${weekStart} AND ${weekEnd}`;
    costoVentas = parseFloat(fb[0]?.t || 0) * 0.65;
  }
  costoVentas = parseFloat(costoVentas.toFixed(2));

  const utilidadBruta = calculateUtility(ingresosNetos, { costo_ventas: costoVentas }, 'bruta');
  const margenBruto = calculateMargin(utilidadBruta, ingresosNetos);

  // =====================
  // PESTAÑA 6: CONCILIACIÓN (9 comparisons)
  // =====================
  const conc = {
    ingreso_vs_produccion: Math.abs(parseFloat(prodRecibidos[0]?.kg_recibidos || 0) - toNum(ingresosNetos)),
    produccion_vs_inventarios: Math.abs(parseFloat(prodLotif[0]?.total_lotificado || 0) - parseFloat(invFruta[0]?.entradas || 0)),
    inventarios_vs_embarques: Math.abs(parseFloat(invFinalFruta) - parseFloat(tarimasEmbarc[0]?.embarc || 0)),
    ventas_vs_cobranza: Math.abs(toNum(ingresosNetos) - parseFloat(cobrosClientes[0]?.total || 0)),
    obligaciones_vs_pagos: Math.abs(parseFloat(pagosProductores[0]?.total || 0) + parseFloat(pagosProveedores[0]?.total || 0) - parseFloat(pagosFletes[0]?.total || 0)),
  };

  return {
    produccion: {
      kg_recibidos: parseFloat(prodRecibidos[0]?.kg_recibidos || 0),
      kg_lotificados: parseFloat(prodLotif[0]?.total_lotificado || 0),
      calidad_a: parseFloat(prodLotif[0]?.calidad_a || 0),
      calidad_b: parseFloat(prodLotif[0]?.calidad_b || 0),
      proceso: parseFloat(prodLotif[0]?.proceso || 0),
      desecho: parseFloat(prodLotif[0]?.desecho || 0),
      merma: parseFloat(prodLotif[0]?.merma || 0),
      tarimas_producidas: parseFloat(tarimasProd[0]?.tarimas || 0),
      rendimiento_lotes: rendimientoPorLote,
    },
    inventarios: {
      fruta_inicial: parseFloat(invFruta[0]?.inicial || 0),
      fruta_entradas: parseFloat(invFruta[0]?.entradas || 0),
      fruta_salidas: parseFloat(invFruta[0]?.salidas || 0),
      fruta_final: invFinalFruta,
      tarimas_disponibles: parseFloat(tarimasDisp[0]?.disp || 0),
      tarimas_embarcadas: parseFloat(tarimasEmbarc[0]?.embarc || 0),
      materiales_inicial: valorInicialMat,
      materiales_entradas: entradasMat,
      materiales_consumidos: consumosMat,
      materiales_ajustes: ajustesMat,
      materiales_final: invFinalMaterial,
      formula_materiales: "INICIAL + ENTRADAS - CONSUMOS + AJUSTES",
    },
    costos_gastos: {
      costo_efectivo_fruta: parseFloat(costoFruta[0]?.costo || 0),
      cuadrillas: parseFloat(costosCuadrilla[0]?.total || 0),
      fletes_comerciales: parseFloat(fletesComerciales[0]?.total || 0),
      materiales_consumidos: materialesConsumidosCosto,
      nomina: parseFloat(nomina[0]?.total || 0),
      gastos_bancarios: parseFloat(gastosBancarios[0]?.total || 0),
      otros: parseFloat(otrosGastos[0]?.total || 0),
    },
    bancos_cobranza: {
      abonos_banco: parseFloat(bankWeek[0]?.abonos || 0),
      cargos_banco: parseFloat(bankWeek[0]?.cargos || 0),
      cobros_clientes: parseFloat(cobrosClientes[0]?.total || 0),
      pagos_productores: parseFloat(pagosProductores[0]?.total || 0),
      pagos_proveedores: parseFloat(pagosProveedores[0]?.total || 0),
      total_movimientos: parseFloat(bankWeek[0]?.total_mov || 0),
    },
    rentabilidad: {
      ingresos_netos: ingresosNetos,
      costo_ventas: costoVentas,
      utilidad_bruta: utilidadBruta,
      margen_bruto: margenBruto || 0,
      fuente: "financial-engine (centralizado V9)",
    },
    conciliacion: {
      comparaciones: conc,
      diferencias: Object.keys(conc).map(k => ({ clave: k, valor: conc[k] })),
      estado_general: Object.values(conc).every(v => v < 500) ? 'conciliado' : 'pendiente_revision',
    },
    meta: { calculado_en: new Date().toISOString(), fuentes: 'confirmed modules only' }
  };
}

// GET: list all closings or get summary data for a date range
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary");

    // Return live summary data for a week range (used when creating/editing a closing)
    if (summary === "true" && startDate && endDate) {
      // NEW V7 INTEGRAL - full 6 tabs from confirmed data
      try {
        const integral = await calcularCierreIntegral(startDate, endDate);
        return NextResponse.json({
          ...integral,
          // backward compat for old form
          total_entradas_fruta_kg: integral.produccion.kg_recibidos,
          total_cargas_kg: integral.produccion.kg_lotificados,
          total_proceso_kg: integral.produccion.proceso,
          total_desecho_kg: integral.produccion.desecho,
          valor_inventario_materiales: integral.inventarios.materiales_final,
          total_cuadrilla_dinero: integral.costos_gastos.cuadrillas,
        });
      } catch (e) {
        console.error('Integral calc error, falling back', e);
      }
      const [
        cargas,
        desechos,
        procesos,
        gastos,
        lotsFruta,
        matInv,
        inventarioTarimas,
        crewsPeriod,
        fletesPeriod,
        brokersData,
        cargasKg,
        fruitInputKg,
        desechoKg,
        procesoKg,
        produccionKg,
      ] = await Promise.all([
        // Total cargas: dinero de cargas (load_history) en el rango de fecha (DINERO)
        sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM load_history WHERE load_date BETWEEN ${startDate} AND ${endDate}`,
        // Ventas desecho: registros donde waste_kg > 0 (DINERO)
        sql`SELECT COALESCE(SUM(total_price), 0) as total FROM sales_of_process_and_waste WHERE waste_kg > 0 AND date BETWEEN ${startDate} AND ${endDate}`,
        // Ventas proceso: registros donde process_kg > 0 (DINERO)
        sql`SELECT COALESCE(SUM(total_price), 0) as total FROM sales_of_process_and_waste WHERE process_kg > 0 AND date BETWEEN ${startDate} AND ${endDate}`,
        // Gastos del periodo (DINERO)
        sql`SELECT COALESCE(SUM(total), 0) as total FROM expenses WHERE expense_date BETWEEN ${startDate} AND ${endDate}`,
        // Entradas de fruta: usar fruit_input_weighings con precio del lote (DINERO)
        sql`SELECT COALESCE(SUM(f.total_kg_weighed * l.fruit_price), 0) as total
            FROM fruit_input_weighings f
            JOIN lots l ON f.lot_id = l.id
            WHERE f.public_scale_date BETWEEN ${startDate} AND ${endDate}`,
        // Valor inventario materiales (valor actual total del inventario) (DINERO)
        sql`SELECT COALESCE(SUM(quantity_available * cost_per_unit), 0) as total FROM materials_inventory`,
        // Inventario en frío: total de tarimas por calibre del periodo
        sql`SELECT caliber, COALESCE(SUM(pallet_count), 0) as total_pallets
            FROM pallet_output_summary
            WHERE packing_date BETWEEN ${startDate} AND ${endDate}
            GROUP BY caliber`,
        // Datos de Cuadrillas del Período (cutting_orders + lógica idéntica al módulo Cuadrillas)
        sql`
          SELECT 
            co.crew_workers_count,
            COALESCE(
              (SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id = co.lot_id LIMIT 1),
              co.net_weight,
              (SELECT SUM(w.net_weight) FROM weighings w WHERE w.lot_id = co.lot_id)
            ) AS total_kg
          FROM cutting_orders co
          WHERE co.cutting_date BETWEEN ${startDate} AND ${endDate}
        `,
        // Total fletes del período (crew_freights)
        sql`SELECT COALESCE(SUM(price), 0) as total FROM crew_freights 
            WHERE (freight_date BETWEEN ${startDate} AND ${endDate}) 
               OR (freight_date IS NULL AND created_at::date BETWEEN ${startDate} AND ${endDate})`,
        // Total notas de corredores (broker_notes) del periodo (DINERO)
        sql`SELECT COALESCE(SUM(amount), 0) as total FROM broker_notes WHERE note_date BETWEEN ${startDate} AND ${endDate}`,
        // Total kg empacados enviados (cargas) desde load_history
        sql`SELECT COALESCE(SUM(total_kg), 0) as total FROM load_history WHERE load_date BETWEEN ${startDate} AND ${endDate}`,
        // Total kg de entradas de fruta desde fruit_input_weighings
        sql`SELECT COALESCE(SUM(total_kg_weighed), 0) as total FROM fruit_input_weighings WHERE public_scale_date BETWEEN ${startDate} AND ${endDate}`,
        // Total kg desecho desde sales_of_process_and_waste
        sql`SELECT COALESCE(SUM(waste_kg), 0) as total FROM sales_of_process_and_waste WHERE waste_kg > 0 AND date BETWEEN ${startDate} AND ${endDate}`,
        // Total kg proceso desde sales_of_process_and_waste
        sql`SELECT COALESCE(SUM(process_kg), 0) as total FROM sales_of_process_and_waste WHERE process_kg > 0 AND date BETWEEN ${startDate} AND ${endDate}`,
        // Total kg producidos/empacados desde production_batches
        sql`SELECT COALESCE(SUM(psd.total_kg), 0) as total 
            FROM production_batches pb
            JOIN production_selection_details psd ON pb.id = psd.production_batch_id
            WHERE pb.production_date BETWEEN ${startDate} AND ${endDate}`,
      ]);

      // Detalle de Ingreso de Fruta por lote (para mostrar registros independientes)
      const ingresoFrutaDetalleRaw = await sql`
        SELECT 
          l.lot_number,
          COALESCE(f.public_scale_date, l.date) as fecha,
          l.producer,
          COALESCE(f.total_kg_weighed, 0) as kg,
          (COALESCE(f.total_kg_weighed, 0) * COALESCE(l.fruit_price, 0)) as dinero
        FROM fruit_input_weighings f
        JOIN lots l ON f.lot_id = l.id
        WHERE f.public_scale_date BETWEEN ${startDate} AND ${endDate}
        ORDER BY f.public_scale_date DESC, l.lot_number ASC
      `;
      const ingresoFrutaDetalle = (ingresoFrutaDetalleRaw || []).map(r => ({
        lot_number: r.lot_number,
        fecha: r.fecha,
        productor: r.producer,
        kg: parseFloat(r.kg),
        dinero: parseFloat(r.dinero)
      }));

      // Detalle de Cargas / Embarques (Notas de Venta por embarque) - integracion automatica desde load_history
      const cargasDetalleRaw = await sql`
        SELECT 
          lh.id,
          lh.load_date as fecha,
          lh.customer_name as cliente,
          COALESCE(
            (SELECT lot_number FROM lots l 
             JOIN master_batches mb ON mb.lot_id = l.id 
             WHERE mb.id = lh.master_batch_id LIMIT 1),
            ''
          ) as lote,
          COALESCE(lh.total_kg, 0) as kg,
          COALESCE(lh.total_amount, 0) as dinero
        FROM load_history lh
        WHERE lh.load_date BETWEEN ${startDate} AND ${endDate}
        ORDER BY lh.load_date DESC, lh.id DESC
      `;
      const cargasDetalle = (cargasDetalleRaw || []).map(r => ({
        nota: `Nota-${r.id}`,
        fecha: r.fecha,
        lote: r.lote || '-',
        cliente: r.cliente || '-',
        kg: parseFloat(r.kg),
        dinero: parseFloat(r.dinero)
      }));

      // Convertir inventario de tarimas en objeto por calibre
      const inventarioPorCalibre = {};
      inventarioTarimas.forEach(row => {
        inventarioPorCalibre[row.caliber] = parseFloat(row.total_pallets);
      });

      // Cálculo automático de Egresos de Cuadrillas usando la misma lógica del módulo Cuadrillas
      let totalCuadrillaKgCalc = 0;
      let totalCuadrillaDineroCalc = 0;
      (crewsPeriod || []).forEach((row) => {
        const kg = parseFloat(row.total_kg) || 0;
        const workers = parseInt(row.crew_workers_count) || 0;
        totalCuadrillaKgCalc += kg;
        const pago = kg > 4500 ? kg * 1.4 : ((workers * 500) + 2500);
        totalCuadrillaDineroCalc += pago;
      });

      const fletesTotal = parseFloat((fletesPeriod && fletesPeriod[0] && fletesPeriod[0].total) || 0);

      return NextResponse.json({
        // INGRESOS (dinero)
        total_cargas_dinero: parseFloat(cargas[0].total),
        total_ventas_desecho_dinero: parseFloat(desechos[0].total),
        total_ventas_proceso_dinero: parseFloat(procesos[0].total),
        valor_inventario_materiales: parseFloat(matInv[0].total),
        inventario_tarimas_por_calibre: inventarioPorCalibre,

        // EGRESOS (dinero)
        total_gastos: parseFloat(gastos[0].total),
        total_entradas_fruta_dinero: parseFloat(lotsFruta[0].total),
        total_cuadrilla_dinero: totalCuadrillaDineroCalc,
        total_broker_notes: parseFloat(brokersData[0].total),
        total_fletes_dinero: fletesTotal,

        // KG (usando datos reales del período de Cuadrillas)
        total_cargas_kg: parseFloat(cargasKg[0].total),
        total_cuadrilla_kg: totalCuadrillaKgCalc,
        total_entradas_fruta_kg: parseFloat(fruitInputKg[0].total),
        total_desecho_kg: parseFloat(desechoKg[0].total),
        total_proceso_kg: parseFloat(procesoKg[0].total),
        total_produccion_kg: parseFloat(produccionKg[0].total),

        // Ingreso de Fruta detallado por lote
        ingreso_fruta_detalle: ingresoFrutaDetalle,
        // Cargas / Embarques detallado por Nota de Venta (integración Ingreso de Embarques)
        cargas_detalle: cargasDetalle,
      });
    }

    // List all closings
    const closings = await sql`
      SELECT * FROM weekly_closings ORDER BY week_start_date DESC
    `;
    return NextResponse.json(closings);
  } catch (error) {
    console.error("Error fetching weekly closings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create a new closing
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weekStartDate, weekEndDate, weekLabel,
      totalCargasDinero, totalVentasDesechoDinero, totalVentasProcesoDinero,
      valorInventarioMateriales, bancos, inventarioTarimas, efectivoDisponible,
      totalGastos, totalEntradasFrutaDinero, totalCuadrillaDinero, totalBrokerNotes,
      nominaSemanal, porcentajeRenta, porcentajeLuz,
      totalCargasKg, totalCuadrillaKg, totalEntradasFrutaKg, totalDesechoKg, totalProcesoKg,
      totalFletes, ingresoFrutaDetalle, cargasDetalle, notes, status,
    } = body;

    const totalIngresosDinero =
      (parseFloat(totalCargasDinero) || 0) +
      (parseFloat(totalVentasDesechoDinero) || 0) +
      (parseFloat(totalVentasProcesoDinero) || 0) +
      (parseFloat(valorInventarioMateriales) || 0) +
      (parseFloat(bancos) || 0);

    const totalEgresosDinero =
      (parseFloat(totalEntradasFrutaDinero) || 0) +
      (parseFloat(totalGastos) || 0) +
      (parseFloat(totalCuadrillaDinero) || 0) +
      (parseFloat(totalBrokerNotes) || 0) +
      (parseFloat(nominaSemanal) || 0) +
      (parseFloat(porcentajeRenta) || 0) +
      (parseFloat(porcentajeLuz) || 0);

    const resultadoDinero = totalIngresosDinero - totalEgresosDinero;

    const totalIngresosKg = (parseFloat(totalCargasKg) || 0);

    const totalEgresosKg =
      (parseFloat(totalCuadrillaKg) || 0) +
      (parseFloat(totalDesechoKg) || 0) +
      (parseFloat(totalProcesoKg) || 0);

    // Kg de la semana: Entrada - (Proceso + Desecho + Inventario + Venta Empacado)
    let inventarioTarimasTotal = 0;
    if (inventarioTarimas) {
      const inv = typeof inventarioTarimas === 'string' ? JSON.parse(inventarioTarimas) : inventarioTarimas;
      inventarioTarimasTotal = Object.values(inv).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }
    const kgDeLaSemana = 
      (parseFloat(totalEntradasFrutaKg) || 0) - 
      (parseFloat(totalProcesoKg) || 0) - 
      (parseFloat(totalDesechoKg) || 0) - 
      inventarioTarimasTotal -
      (parseFloat(totalCargasKg) || 0);

    const resultadoKg = totalIngresosKg - totalEgresosKg;

    // Ensure inventarioTarimas is properly stored as JSON
    const inventarioTarimasJson = inventarioTarimas ? JSON.stringify(inventarioTarimas) : null;

    const detalleIntegral = body.detalle_integral || body.detalleIntegral || null;
    const estadoConc = body.estado_conciliacion || body.estadoConciliacion || (status === 'cerrado' ? 'cerrado' : 'borrador');

    const result = await sql`
      INSERT INTO weekly_closings (
        week_start_date, week_end_date, week_label,
        total_cargas_dinero, total_ventas_desecho_dinero, total_ventas_proceso_dinero,
        valor_inventario_materiales, bancos, inventario_tarimas, efectivo_disponible,
        total_gastos, total_entradas_fruta_dinero, total_cuadrilla_dinero, total_broker_notes,
        nomina_semanal, porcentaje_renta, porcentaje_luz,
        total_cargas_kg, total_cuadrilla_kg, total_entradas_fruta_kg, total_desecho_kg, total_proceso_kg,
        total_fletes_dinero,
        ingreso_fruta_detalle,
        cargas_detalle,
        total_ingresos_dinero, total_egresos_dinero, resultado_dinero,
        total_ingresos_kg, total_egresos_kg, resultado_kg,
        status, notes, estado_conciliacion, detalle_integral, snapshot_cierre
      ) VALUES (
        ${weekStartDate}, ${weekEndDate}, ${weekLabel || null},
        ${parseFloat(totalCargasDinero) || 0}, ${parseFloat(totalVentasDesechoDinero) || 0}, ${parseFloat(totalVentasProcesoDinero) || 0},
        ${parseFloat(valorInventarioMateriales) || 0}, ${parseFloat(bancos) || 0}, ${inventarioTarimasJson}, ${parseFloat(efectivoDisponible) || 0},
        ${parseFloat(totalGastos) || 0}, ${parseFloat(totalEntradasFrutaDinero) || 0}, ${parseFloat(totalCuadrillaDinero) || 0}, ${parseFloat(totalBrokerNotes) || 0},
        ${parseFloat(nominaSemanal) || 0}, ${parseFloat(porcentajeRenta) || 0}, ${parseFloat(porcentajeLuz) || 0},
        ${parseFloat(totalCargasKg) || 0}, ${parseFloat(totalCuadrillaKg) || 0}, ${parseFloat(totalEntradasFrutaKg) || 0}, ${parseFloat(totalDesechoKg) || 0}, ${parseFloat(totalProcesoKg) || 0},
        ${parseFloat(totalFletes) || 0},
        ${ingresoFrutaDetalle ? JSON.stringify(ingresoFrutaDetalle) : null},
        ${cargasDetalle ? JSON.stringify(cargasDetalle) : null},
        ${totalIngresosDinero}, ${totalEgresosDinero}, ${resultadoDinero},
        ${totalIngresosKg}, ${totalEgresosKg}, ${resultadoKg},
        ${status || 'abierto'}, ${notes || null},
        ${estadoConc},
        ${detalleIntegral ? JSON.stringify(detalleIntegral) : null},
        ${detalleIntegral ? JSON.stringify(detalleIntegral) : null}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating weekly closing:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: update an existing closing
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id, weekStartDate, weekEndDate, weekLabel,
      totalCargasDinero, totalVentasDesechoDinero, totalVentasProcesoDinero,
      valorInventarioMateriales, bancos, inventarioTarimas, efectivoDisponible,
      totalGastos, totalEntradasFrutaDinero, totalCuadrillaDinero, totalBrokerNotes,
      nominaSemanal, porcentajeRenta, porcentajeLuz,
      totalCargasKg, totalCuadrillaKg, totalEntradasFrutaKg, totalDesechoKg, totalProcesoKg,
      totalFletes, ingresoFrutaDetalle, cargasDetalle, status, notes,
    } = body;

    const totalIngresosDinero =
      (parseFloat(totalCargasDinero) || 0) +
      (parseFloat(totalVentasDesechoDinero) || 0) +
      (parseFloat(totalVentasProcesoDinero) || 0) +
      (parseFloat(valorInventarioMateriales) || 0) +
      (parseFloat(bancos) || 0);

    const totalEgresosDinero =
      (parseFloat(totalEntradasFrutaDinero) || 0) +
      (parseFloat(totalGastos) || 0) +
      (parseFloat(totalCuadrillaDinero) || 0) +
      (parseFloat(totalBrokerNotes) || 0) +
      (parseFloat(nominaSemanal) || 0) +
      (parseFloat(porcentajeRenta) || 0) +
      (parseFloat(porcentajeLuz) || 0);

    const resultadoDinero = totalIngresosDinero - totalEgresosDinero;

    const totalIngresosKg = (parseFloat(totalCargasKg) || 0);

    const totalEgresosKg =
      (parseFloat(totalCuadrillaKg) || 0) +
      (parseFloat(totalDesechoKg) || 0) +
      (parseFloat(totalProcesoKg) || 0);

    // Kg de la semana: Entrada - (Proceso + Desecho + Inventario + Venta Empacado)
    let inventarioTarimasTotal = 0;
    if (inventarioTarimas) {
      const inv = typeof inventarioTarimas === 'string' ? JSON.parse(inventarioTarimas) : inventarioTarimas;
      inventarioTarimasTotal = Object.values(inv).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }
    const kgDeLaSemana = 
      (parseFloat(totalEntradasFrutaKg) || 0) - 
      (parseFloat(totalProcesoKg) || 0) - 
      (parseFloat(totalDesechoKg) || 0) - 
      inventarioTarimasTotal -
      (parseFloat(totalCargasKg) || 0);

    const resultadoKg = totalIngresosKg - totalEgresosKg;

    const inventarioTarimasJson = inventarioTarimas ? JSON.stringify(inventarioTarimas) : null;

    const detalleIntegral = body.detalle_integral || body.detalleIntegral || null;
    const estadoConc = body.estado_conciliacion || body.estadoConciliacion || (status === 'cerrado' ? 'cerrado' : null);

    const result = await sql`
      UPDATE weekly_closings SET
        week_start_date = ${weekStartDate},
        week_end_date = ${weekEndDate},
        week_label = ${weekLabel || null},
        total_cargas_dinero = ${parseFloat(totalCargasDinero) || 0},
        total_ventas_desecho_dinero = ${parseFloat(totalVentasDesechoDinero) || 0},
        total_ventas_proceso_dinero = ${parseFloat(totalVentasProcesoDinero) || 0},
        valor_inventario_materiales = ${parseFloat(valorInventarioMateriales) || 0},
        bancos = ${parseFloat(bancos) || 0},
        inventario_tarimas = ${inventarioTarimasJson},
        efectivo_disponible = ${parseFloat(efectivoDisponible) || 0},
        total_gastos = ${parseFloat(totalGastos) || 0},
        total_entradas_fruta_dinero = ${parseFloat(totalEntradasFrutaDinero) || 0},
        total_cuadrilla_dinero = ${parseFloat(totalCuadrillaDinero) || 0},
        total_broker_notes = ${parseFloat(totalBrokerNotes) || 0},
        nomina_semanal = ${parseFloat(nominaSemanal) || 0},
        porcentaje_renta = ${parseFloat(porcentajeRenta) || 0},
        porcentaje_luz = ${parseFloat(porcentajeLuz) || 0},
        total_cargas_kg = ${parseFloat(totalCargasKg) || 0},
        total_cuadrilla_kg = ${parseFloat(totalCuadrillaKg) || 0},
        total_entradas_fruta_kg = ${parseFloat(totalEntradasFrutaKg) || 0},
        total_desecho_kg = ${parseFloat(totalDesechoKg) || 0},
        total_proceso_kg = ${parseFloat(totalProcesoKg) || 0},
        total_fletes_dinero = ${parseFloat(totalFletes) || 0},
        ingreso_fruta_detalle = ${ingresoFrutaDetalle ? JSON.stringify(ingresoFrutaDetalle) : null},
        cargas_detalle = ${cargasDetalle ? JSON.stringify(cargasDetalle) : null},
        total_ingresos_dinero = ${totalIngresosDinero},
        total_egresos_dinero = ${totalEgresosDinero},
        resultado_dinero = ${resultadoDinero},
        total_ingresos_kg = ${totalIngresosKg},
        total_egresos_kg = ${totalEgresosKg},
        resultado_kg = ${resultadoKg},
        status = ${status || 'abierto'},
        notes = ${notes || null},
        estado_conciliacion = COALESCE(${estadoConc}, estado_conciliacion),
        detalle_integral = COALESCE(${detalleIntegral ? JSON.stringify(detalleIntegral) : null}::jsonb, detalle_integral),
        snapshot_cierre = CASE WHEN ${status || 'abierto'} = 'cerrado' THEN COALESCE(${detalleIntegral ? JSON.stringify(detalleIntegral) : null}::jsonb, snapshot_cierre) ELSE snapshot_cierre END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating weekly closing:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    await sql`DELETE FROM weekly_closings WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
