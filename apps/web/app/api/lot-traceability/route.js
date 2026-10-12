import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API de Trazabilidad del Lote
 * Retorna toda la información de trazabilidad de un lote desde el corte hasta la venta
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');

    if (!lotId) {
      return NextResponse.json(
        { error: 'lot_id es requerido' },
        { status: 400 }
      );
    }

    // 1. Datos generales del lote
    const lotData = await sql`
      SELECT * FROM lots WHERE id = ${parseInt(lotId)}
    `;

    if (lotData.length === 0) {
      return NextResponse.json(
        { error: 'Lote no encontrado' },
        { status: 404 }
      );
    }

    const lot = lotData[0];

    // 2. Orden de corte
    const cuttingOrders = await sql`
      SELECT * FROM cutting_orders 
      WHERE lot_id = ${parseInt(lotId)}
      ORDER BY cutting_date DESC
    `;

    // 3. Ingreso de fruta
    const ingresoData = await sql`
      SELECT 
        COALESCE(SUM(total_kg_weighed), 0) as total_kg,
        COALESCE(SUM(full_field_boxes), 0) as full_boxes,
        COALESCE(SUM(empty_field_boxes), 0) as empty_boxes
      FROM fruit_input_weighings
      WHERE lot_id = ${parseInt(lotId)}
    `;

    // 4. Producción (empacado)
    const produccionData = await sql`
      SELECT 
        COALESCE(SUM(psd.total_kg), 0) as total_kg
      FROM production_batches pb
      JOIN production_selection_details psd ON pb.id = psd.production_batch_id
      WHERE pb.lot_id = ${parseInt(lotId)}
    `;

    const produccionPorCalibre = await sql`
      SELECT 
        psd.caliber,
        psd.class_name,
        COALESCE(SUM(psd.total_kg), 0) as total_kg,
        COALESCE(SUM(psd.pallets_complete), 0) as pallets
      FROM production_batches pb
      JOIN production_selection_details psd ON pb.id = psd.production_batch_id
      WHERE pb.lot_id = ${parseInt(lotId)}
      GROUP BY psd.caliber, psd.class_name
      ORDER BY psd.caliber, psd.class_name
    `;

    const procesoDesechodata = await sql`
      SELECT 
        COALESCE(SUM(total_kg_process), 0) as proceso_kg,
        COALESCE(SUM(total_kg_waste), 0) as desecho_kg
      FROM production_batches
      WHERE lot_id = ${parseInt(lotId)}
    `;

    // 5. Inventario actual
    const inventarioEmpacado = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as total_kg
      FROM lot_inventory
      WHERE lot_id = ${parseInt(lotId)}
    `;

    const inventarioProceso = await sql`
      SELECT COALESCE(SUM(kg_available), 0) as kg_available
      FROM lot_process_inventory
      WHERE lot_id = ${parseInt(lotId)}
    `;

    const inventarioDesecho = await sql`
      SELECT COALESCE(SUM(kg_available), 0) as kg_available
      FROM lot_waste_inventory
      WHERE lot_id = ${parseInt(lotId)}
    `;

    // 6. Ventas
    const ventasEmpacado = await sql`
      SELECT 
        COALESCE(SUM(total_kg), 0) as total_kg,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM load_history
      WHERE lot_id = ${parseInt(lotId)}
    `;

    const cargasDetalle = await sql`
      SELECT * FROM load_history
      WHERE lot_id = ${parseInt(lotId)}
      ORDER BY load_date DESC
    `;

    const ventasProceso = await sql`
      SELECT 
        COALESCE(SUM(process_kg), 0) as total_kg,
        COALESCE(SUM(total_price), 0) as total_amount
      FROM sales_of_process_and_waste
      WHERE lot_id = ${parseInt(lotId)} AND process_kg > 0
    `;

    const ventasDesecho = await sql`
      SELECT 
        COALESCE(SUM(waste_kg), 0) as total_kg,
        COALESCE(SUM(total_price), 0) as total_amount
      FROM sales_of_process_and_waste
      WHERE lot_id = ${parseInt(lotId)} AND waste_kg > 0
    `;

    // 7. Materiales utilizados
    const materialesUsados = await sql`
      SELECT 
        mi.material_name,
        mi.unit,
        COALESCE(SUM(md.quantity_used), 0) as quantity_used,
        mi.cost_per_unit,
        COALESCE(SUM(md.quantity_used * mi.cost_per_unit), 0) as total_cost
      FROM production_batches pb
      JOIN material_deductions md ON pb.id = md.production_batch_id
      JOIN materials_inventory mi ON md.material_id = mi.id
      WHERE pb.lot_id = ${parseInt(lotId)}
      GROUP BY mi.id, mi.material_name, mi.unit, mi.cost_per_unit
    `;

    // 8. Cálculo de utilidad
    const kgIngresados = parseFloat(ingresoData[0].total_kg);
    const kgEmpacados = parseFloat(produccionData[0].total_kg);
    const kgProceso = parseFloat(procesoDesechodata[0].proceso_kg);
    const kgDesecho = parseFloat(procesoDesechodata[0].desecho_kg);
    const kgVendidosEmpacado = parseFloat(ventasEmpacado[0].total_kg);
    const kgVendidosProceso = parseFloat(ventasProceso[0].total_kg);
    const kgVendidosDesecho = parseFloat(ventasDesecho[0].total_kg);
    const kgDisponibles = (kgEmpacados - kgVendidosEmpacado) + (kgProceso - kgVendidosProceso) + (kgDesecho - kgVendidosDesecho);

    const ingresoTotal = parseFloat(ventasEmpacado[0].total_amount) + parseFloat(ventasProceso[0].total_amount) + parseFloat(ventasDesecho[0].total_amount);
    const costoFruta = (lot.fruit_price || 0) * kgIngresados;
    const costoMateriales = materialesUsados.reduce((sum, m) => sum + parseFloat(m.total_cost || 0), 0);
    const costoTotal = costoFruta + costoMateriales;
    const utilidadNeta = ingresoTotal - costoTotal;

    // Construir respuesta
    const response = {
      lot: lot,
      orden_corte: cuttingOrders[0] || null,
      ingreso: {
        total_kg: parseFloat(ingresoData[0].total_kg),
        full_boxes: parseInt(ingresoData[0].full_boxes),
        empty_boxes: parseInt(ingresoData[0].empty_boxes)
      },
      produccion: {
        total_kg: kgEmpacados,
        proceso_kg: kgProceso,
        desecho_kg: kgDesecho,
        by_caliber: produccionPorCalibre
      },
      inventario: {
        empacado_kg: parseFloat(inventarioEmpacado[0].total_kg),
        proceso_kg: parseFloat(inventarioProceso[0].kg_available),
        desecho_kg: parseFloat(inventarioDesecho[0].kg_available)
      },
      ventas: {
        empacado_kg: kgVendidosEmpacado,
        empacado_monto: parseFloat(ventasEmpacado[0].total_amount),
        proceso_kg: kgVendidosProceso,
        proceso_monto: parseFloat(ventasProceso[0].total_amount),
        desecho_kg: kgVendidosDesecho,
        desecho_monto: parseFloat(ventasDesecho[0].total_amount),
        cargas: cargasDetalle
      },
      materiales: materialesUsados,
      resumen: {
        kg_cortados: cuttingOrders[0]?.net_weight || 0,
        kg_ingresados: kgIngresados,
        kg_empacados: kgEmpacados,
        kg_proceso: kgProceso,
        kg_desecho: kgDesecho,
        kg_vendidos: kgVendidosEmpacado + kgVendidosProceso + kgVendidosDesecho,
        kg_disponibles: kgDisponibles,
        ingreso_total: ingresoTotal,
        costo_fruta: costoFruta,
        costo_materiales: costoMateriales,
        costo_total: costoTotal,
        utilidad_neta: utilidadNeta,
        utilidad_por_kg: kgIngresados > 0 ? utilidadNeta / kgIngresados : 0
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching lot traceability:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
