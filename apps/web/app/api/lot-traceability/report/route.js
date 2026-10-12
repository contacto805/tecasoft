import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lot_id');
    const format = searchParams.get('format') || 'json'; // json, csv

    if (!lotId) {
      return NextResponse.json({ error: "lot_id is required" }, { status: 400 });
    }

    // Get lot details
    const lot = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
    if (!lot.length) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const lotData = lot[0];

    // Get all related data
    const cuttingOrder = await sql`SELECT * FROM cutting_orders WHERE lot_id = ${lotId}`;
    const fruitInput = await sql`SELECT * FROM fruit_input_weighings WHERE lot_id = ${lotId}`;
    const production = await sql`SELECT * FROM production_batches WHERE lot_id = ${lotId}`;
    const inventory = await sql`SELECT * FROM lot_inventory WHERE lot_id = ${lotId}`;
    const processInventory = await sql`SELECT * FROM lot_process_inventory WHERE lot_id = ${lotId}`;
    const wasteInventory = await sql`SELECT * FROM lot_waste_inventory WHERE lot_id = ${lotId}`;
    const loads = await sql`SELECT * FROM load_history WHERE lot_id = ${lotId} ORDER BY load_date DESC`;
    const loadDetails = await sql`SELECT * FROM load_details WHERE lot_id = ${lotId}`;
    const materialDeductions = await sql`SELECT * FROM material_deductions WHERE production_batch_id IN (SELECT id FROM production_batches WHERE lot_id = ${lotId})`;
    const materials = await sql`SELECT * FROM materials_inventory`;

    // Build report data
    const report = {
      lot: {
        id: lotData.id,
        lot_number: lotData.lot_number,
        producer: lotData.producer,
        orchard: lotData.orchard_name,
        origin: lotData.origin,
        date: lotData.date,
        status: lotData.status,
        broker_name: lotData.broker_name,
        destination: lotData.destination,
        client_name: lotData.client_name
      },
      cutting: {
        cutting_date: cuttingOrder.length > 0 ? cuttingOrder[0].cutting_date : null,
        crew_chief: cuttingOrder.length > 0 ? cuttingOrder[0].crew_chief_name : null,
        total_kg_cut: lotData.total_kg_cut || 0,
        crew_workers: cuttingOrder.length > 0 ? cuttingOrder[0].crew_workers_count : 0,
        crew_payment: cuttingOrder.length > 0 ? cuttingOrder[0].crew_payment_method : null
      },
      intake: {
        intake_date: fruitInput.length > 0 ? fruitInput[0].public_scale_date : null,
        total_kg_received: lotData.total_kg_received || 0,
        boxes_full: fruitInput.length > 0 ? fruitInput[0].full_field_boxes : 0,
        boxes_empty: fruitInput.length > 0 ? fruitInput[0].empty_field_boxes : 0,
        reception_responsible: fruitInput.length > 0 ? fruitInput[0].reception_responsible : null
      },
      production: {
        total_kg_packed: lotData.total_kg_packed || 0,
        production_count: production.length,
        production_dates: production.map(p => p.production_date)
      },
      inventory_summary: {
        current_inventory: inventory.map(inv => ({
          caliber: inv.caliber,
          class: inv.class_name,
          kg: inv.total_kg
        })),
        process_inventory: processInventory.map(proc => ({
          caliber: proc.caliber,
          kg: proc.total_kg
        })),
        waste_inventory: wasteInventory.map(waste => ({
          caliber: waste.caliber,
          kg: waste.total_kg
        })),
        total_process_kg: lotData.total_kg_process || 0,
        total_waste_kg: lotData.total_kg_waste || 0,
        total_inventory_kg: lotData.total_kg_inventory || 0
      },
      sales: {
        total_loads: loads.length,
        total_kg_sold: lotData.total_kg_sold || 0,
        total_revenue: lotData.total_revenue || 0,
        loads: loads.map(load => ({
          id: load.id,
          date: load.load_date,
          customer: load.customer_name,
          destination: load.destination,
          total_kg: load.total_kg,
          total_amount: load.total_amount,
          currency: load.currency,
          driver: load.driver_name,
          truck_plates: load.truck_plates,
          payment_status: load.payment_status,
          details: loadDetails
            .filter(d => d.load_id === load.id)
            .map(d => ({
              caliber: d.caliber,
              class: d.class_name,
              pallets: d.pallets,
              boxes: d.boxes,
              kg: d.total_kg,
              price_per_kg: d.unit_price,
              subtotal: d.subtotal
            }))
        }))
      },
      materials: {
        deductions: materialDeductions.map(md => {
          const material = materials.find(m => m.id === md.material_id);
          return {
            material_name: material ? material.material_name : 'Unknown',
            quantity_used: md.quantity_used,
            unit: material ? material.unit : null
          };
        })
      },
      profitability: {
        total_cost: lotData.total_cost || 0,
        net_profit: lotData.net_profit || 0,
        margin_percentage: lotData.total_revenue > 0 ? ((lotData.net_profit / lotData.total_revenue) * 100).toFixed(2) : 0
      }
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvContent = generateCSV(report);
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="traceability_${lotData.lot_number}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error in GET /api/lot-traceability/report:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateCSV(report) {
  let csv = 'TRAZABILIDAD DEL LOTE\n\n';
  csv += 'DATOS GENERALES\n';
  csv += `Lote,${report.lot.lot_number}\n`;
  csv += `Productor,${report.lot.producer}\n`;
  csv += `Huerta,${report.lot.orchard}\n`;
  csv += `Cliente,${report.lot.client_name}\n`;
  csv += `Destino,${report.lot.destination}\n`;
  csv += `Estado,${report.lot.status}\n\n`;

  csv += 'CORTE\n';
  csv += `Fecha,${report.cutting.cutting_date}\n`;
  csv += `Jefe de Cuadrilla,${report.cutting.crew_chief}\n`;
  csv += `Kg Cortados,${report.cutting.total_kg_cut}\n\n`;

  csv += 'INGRESO\n';
  csv += `Fecha,${report.intake.intake_date}\n`;
  csv += `Kg Ingresados,${report.intake.total_kg_received}\n`;
  csv += `Cajas Llenas,${report.intake.boxes_full}\n`;
  csv += `Cajas Vacías,${report.intake.boxes_empty}\n\n`;

  csv += 'PRODUCCIÓN\n';
  csv += `Kg Empacados,${report.production.total_kg_packed}\n`;
  csv += `Registros de Producción,${report.production.production_count}\n\n`;

  csv += 'INVENTARIO ACTUAL\n';
  csv += 'Calibre,Clase,Kg\n';
  report.inventory_summary.current_inventory.forEach(inv => {
    csv += `${inv.caliber},${inv.class},${inv.kg}\n`;
  });
  csv += `\nTotal Proceso,${report.inventory_summary.total_process_kg} kg\n`;
  csv += `Total Desecho,${report.inventory_summary.total_waste_kg} kg\n\n`;

  csv += 'VENTAS\n';
  csv += `Total Cargas,${report.sales.total_loads}\n`;
  csv += `Total Kg Vendidos,${report.sales.total_kg_sold}\n`;
  csv += `Total Ingresos,${report.sales.total_revenue}\n`;
  csv += '\nDetalle de Cargas:\n';
  csv += 'Fecha,Cliente,Destino,Kg,Monto,Moneda,Estado\n';
  report.sales.loads.forEach(load => {
    csv += `${load.date},${load.customer},${load.destination},${load.total_kg},${load.total_amount},${load.currency},${load.payment_status}\n`;
  });
  csv += '\n';

  csv += 'RENTABILIDAD\n';
  csv += `Costo Total,${report.profitability.total_cost}\n`;
  csv += `Utilidad Neta,${report.profitability.net_profit}\n`;
  csv += `Margen (%),${report.profitability.margin_percentage}%\n`;

  return csv;
}
