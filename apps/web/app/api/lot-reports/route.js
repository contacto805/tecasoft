import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Generate comprehensive lot reports with PDF data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');
    const format = searchParams.get('format') || 'json'; // json, csv, pdf

    if (!lotId) {
      return NextResponse.json({ error: "lot_id is required" }, { status: 400 });
    }

    // Fetch all lot data
    const lot = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const lotData = lot[0];

    // Get all related data
    const [
      cuttingOrders,
      fruitInputs,
      production,
      inventory,
      loads,
      materialDeductions
    ] = await Promise.all([
      sql`SELECT * FROM cutting_orders WHERE lot_id = ${lotId}`,
      sql`SELECT * FROM fruit_input_weighings WHERE lot_id = ${lotId}`,
      sql`SELECT * FROM production_batches WHERE lot_id = ${lotId}`,
      sql`SELECT * FROM lot_inventory WHERE lot_id = ${lotId}`,
      sql`SELECT * FROM load_history WHERE lot_id = ${lotId}`,
      sql`SELECT md.*, m.material_name, m.unit FROM material_deductions md JOIN materials_inventory m ON md.material_id = m.id WHERE md.production_batch_id IN (SELECT id FROM production_batches WHERE lot_id = ${lotId})`
    ]);

    // Build report object
    const report = {
      lot: {
        id: lotData.id,
        lot_number: lotData.lot_number,
        producer: lotData.producer,
        orchard: lotData.orchard_name,
        date: lotData.date,
        destination: lotData.destination,
        client: lotData.client_name,
        broker: lotData.broker_name,
        status: lotData.status
      },
      operations: {
        cutting: {
          date: cuttingOrders.length > 0 ? cuttingOrders[0].cutting_date : null,
          crew_chief: cuttingOrders.length > 0 ? cuttingOrders[0].crew_chief_name : null,
          workers: cuttingOrders.length > 0 ? cuttingOrders[0].crew_workers_count : 0,
          total_kg: parseFloat(lotData.total_kg_cut) || 0
        },
        intake: {
          date: fruitInputs.length > 0 ? fruitInputs[0].public_scale_date : null,
          responsible: fruitInputs.length > 0 ? fruitInputs[0].reception_responsible : null,
          total_kg: parseFloat(lotData.total_kg_received) || 0,
          full_boxes: fruitInputs.length > 0 ? fruitInputs[0].full_field_boxes : 0,
          empty_boxes: fruitInputs.length > 0 ? fruitInputs[0].empty_field_boxes : 0
        },
        production: {
          records: production.length,
          total_kg_packed: parseFloat(lotData.total_kg_packed) || 0,
          calibers: inventory.map(inv => ({
            caliber: inv.caliber,
            class: inv.class_name,
            kg: parseFloat(inv.total_kg)
          }))
        }
      },
      sales: {
        total_loads: loads.length,
        total_kg_sold: parseFloat(lotData.total_kg_sold) || 0,
        total_revenue: parseFloat(lotData.total_revenue) || 0,
        loads: loads.map(load => ({
          id: load.id,
          date: load.load_date,
          customer: load.customer_name,
          kg: load.total_kg,
          amount: load.total_amount,
          currency: load.currency,
          driver: load.driver_name
        }))
      },
      losses: {
        process_kg: parseFloat(lotData.total_kg_process) || 0,
        waste_kg: parseFloat(lotData.total_kg_waste) || 0,
        shrinkage_percentage: lotData.total_kg_received > 0
          ? (((parseFloat(lotData.total_kg_received) - parseFloat(lotData.total_kg_packed) - parseFloat(lotData.total_kg_process) - parseFloat(lotData.total_kg_waste)) / parseFloat(lotData.total_kg_received)) * 100).toFixed(2)
          : 0
      },
      materials: {
        deductions: materialDeductions.map(md => ({
          material: md.material_name,
          quantity: md.quantity_used,
          unit: md.unit
        }))
      },
      financial: {
        total_cost: parseFloat(lotData.total_cost) || 0,
        total_revenue: parseFloat(lotData.total_revenue) || 0,
        net_profit: parseFloat(lotData.net_profit) || 0,
        margin_percentage: lotData.total_revenue > 0 
          ? ((parseFloat(lotData.net_profit) / parseFloat(lotData.total_revenue)) * 100).toFixed(2)
          : 0
      },
      efficiency: {
        reception_efficiency: lotData.total_kg_received > 0 
          ? ((parseFloat(lotData.total_kg_packed) / parseFloat(lotData.total_kg_received)) * 100).toFixed(2)
          : 0,
        sales_efficiency: lotData.total_kg_packed > 0
          ? ((parseFloat(lotData.total_kg_sold) / parseFloat(lotData.total_kg_packed)) * 100).toFixed(2)
          : 0,
        yield_percentage: lotData.total_kg_cut > 0
          ? ((parseFloat(lotData.total_kg_packed) / parseFloat(lotData.total_kg_cut)) * 100).toFixed(2)
          : 0
      }
    };

    if (format === 'csv') {
      return new Response(generateCSV(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="report_${lotData.lot_number}.csv"`
        }
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error in GET /api/lot-reports:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateCSV(report) {
  let csv = `REPORTE DE LOTE\n\n`;
  csv += `DATOS GENERALES\n`;
  csv += `Lote,${report.lot.lot_number}\n`;
  csv += `Productor,${report.lot.producer}\n`;
  csv += `Huerta,${report.lot.orchard}\n`;
  csv += `Cliente,${report.lot.client}\n`;
  csv += `Estado,${report.lot.status}\n\n`;

  csv += `OPERACIONES\n`;
  csv += `CORTE\n`;
  csv += `Fecha,${report.operations.cutting.date}\n`;
  csv += `Jefe de Cuadrilla,${report.operations.cutting.crew_chief}\n`;
  csv += `Kg Cortados,${report.operations.cutting.total_kg}\n\n`;

  csv += `INGRESO\n`;
  csv += `Fecha,${report.operations.intake.date}\n`;
  csv += `Kg Ingresados,${report.operations.intake.total_kg}\n`;
  csv += `Cajas Llenas,${report.operations.intake.full_boxes}\n\n`;

  csv += `PRODUCCIÓN\n`;
  csv += `Kg Empacados,${report.operations.production.total_kg_packed}\n`;
  csv += `Calibres\n`;
  csv += `Calibre,Clase,Kg\n`;
  report.operations.production.calibers.forEach(c => {
    csv += `${c.caliber},${c.class},${c.kg}\n`;
  });
  csv += `\n`;

  csv += `VENTAS\n`;
  csv += `Total Cargas,${report.sales.total_loads}\n`;
  csv += `Kg Vendidos,${report.sales.total_kg_sold}\n`;
  csv += `Ingresos Totales,${report.sales.total_revenue}\n\n`;

  csv += `PÉRDIDAS\n`;
  csv += `Kg de Proceso,${report.losses.process_kg}\n`;
  csv += `Kg de Desecho,${report.losses.waste_kg}\n`;
  csv += `Merma (%),${report.losses.shrinkage_percentage}\n\n`;

  csv += `FINANZAS\n`;
  csv += `Costo Total,${report.financial.total_cost}\n`;
  csv += `Ingresos Totales,${report.financial.total_revenue}\n`;
  csv += `Utilidad Neta,${report.financial.net_profit}\n`;
  csv += `Margen (%),${report.financial.margin_percentage}\n\n`;

  csv += `EFICIENCIA\n`;
  csv += `Eficiencia de Recepción (%),${report.efficiency.reception_efficiency}\n`;
  csv += `Eficiencia de Ventas (%),${report.efficiency.sales_efficiency}\n`;
  csv += `Rendimiento (%),${report.efficiency.yield_percentage}\n`;

  return csv;
}
