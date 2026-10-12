import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: list all closings or get summary data for a date range
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary");

    // Return live summary data for a week range (used when creating/editing a closing)
    if (summary === "true" && startDate && endDate) {
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
        status, notes
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
        ${status || 'abierto'}, ${notes || null}
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
