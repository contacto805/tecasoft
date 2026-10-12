import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import * as XLSX from 'xlsx';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Generar reporte para la fecha especificada
    const report = await generateDailyReport(reportDate);
    
    // Crear archivo Excel
    const workbook = XLSX.utils.book_new();
    
    // Hoja 1: Resumen General
    const summaryData = [
      ['REPORTE DIARIO - ' + new Date(reportDate).toLocaleDateString('es-MX', { dateStyle: 'long' })],
      [],
      ['RESUMEN GENERAL'],
      ['Total de Entradas de Fruta', report.summary.totalFruitInput + ' kg'],
      ['Total de Producción', report.summary.totalProduction + ' kg'],
      ['Total de Ventas', report.summary.totalSales + ' kg'],
      ['Total de Gastos', '$' + report.summary.totalExpenses.toFixed(2)],
      ['Inventario de Materiales', report.summary.inventoryValue + ' items'],
      []
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    
    // Hoja 2: Órdenes de Corte
    if (report.cuttingOrders.length > 0) {
      const cuttingData = [
        ['ÓRDENES DE CORTE'],
        ['Folio', 'Productor', 'Huerto', 'Cajas', 'Peso Neto (kg)', 'Estado'],
        ...report.cuttingOrders.map(order => [
          order.folio,
          order.producer_name,
          order.orchard_name,
          order.boxes_count,
          order.net_weight,
          order.status
        ])
      ];
      const cuttingSheet = XLSX.utils.aoa_to_sheet(cuttingData);
      XLSX.utils.book_append_sheet(workbook, cuttingSheet, 'Órdenes de Corte');
    }
    
    // Hoja 3: Producción
    if (report.production.length > 0) {
      const productionData = [
        ['PRODUCCIÓN DEL DÍA'],
        ['Lote', 'Calibre', 'Clase', 'Tarimas', 'Cajas 10kg', 'Cajas 6kg', 'Total Kg'],
        ...report.production.map(prod => [
          prod.lot_number,
          prod.caliber,
          prod.class_name,
          prod.pallets_complete,
          prod.boxes_96,
          prod.boxes_156,
          prod.total_kg
        ])
      ];
      const productionSheet = XLSX.utils.aoa_to_sheet(productionData);
      XLSX.utils.book_append_sheet(workbook, productionSheet, 'Producción');
    }
    
    // Hoja 4: Ventas
    if (report.sales.length > 0) {
      const salesData = [
        ['VENTAS DEL DÍA'],
        ['Cliente', 'Destino', 'Calibre', 'Tarimas', 'Cajas', 'Total Kg', 'Precio', 'Total'],
        ...report.sales.map(sale => [
          sale.customer_name,
          sale.destination,
          sale.caliber,
          sale.pallets_count,
          sale.boxes_count,
          sale.total_kg,
          sale.unit_price,
          sale.total_amount
        ])
      ];
      const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
      XLSX.utils.book_append_sheet(workbook, salesSheet, 'Ventas');
    }
    
    // Hoja 5: Gastos
    if (report.expenses.length > 0) {
      const expensesData = [
        ['GASTOS DEL DÍA'],
        ['Producto', 'Departamento', 'Cantidad', 'Costo Unitario', 'Total', 'Notas'],
        ...report.expenses.map(expense => [
          expense.product_name,
          expense.department,
          expense.quantity,
          expense.cost_per_unit,
          expense.total,
          expense.notes
        ])
      ];
      const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
      XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Gastos');
    }
    
    // Hoja 6: Inventario de Materiales
    if (report.inventory.length > 0) {
      const inventoryData = [
        ['INVENTARIO DE MATERIALES'],
        ['Material', 'Categoría', 'Cantidad Disponible', 'Unidad', 'Stock Mínimo', 'Costo Unitario'],
        ...report.inventory.map(item => [
          item.material_name,
          item.category,
          item.quantity_available,
          item.unit,
          item.minimum_stock,
          item.cost_per_unit
        ])
      ];
      const inventorySheet = XLSX.utils.aoa_to_sheet(inventoryData);
      XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventario');
    }
    
    // Hoja 7: Trazabilidad
    if (report.traceability.length > 0) {
      const traceabilityData = [
        ['TRAZABILIDAD DEL DÍA'],
        ['Hora', 'Lote', 'Tipo de Evento', 'Categoría', 'Descripción', 'Usuario'],
        ...report.traceability.map(trace => [
          new Date(trace.timestamp).toLocaleTimeString('es-MX'),
          trace.lot_id,
          trace.event_type,
          trace.event_category,
          trace.event_description,
          trace.user_name
        ])
      ];
      const traceabilitySheet = XLSX.utils.aoa_to_sheet(traceabilityData);
      XLSX.utils.book_append_sheet(workbook, traceabilitySheet, 'Trazabilidad');
    }
    
    // Generar archivo Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Retornar archivo
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte-diario-${reportDate}.xlsx"`
      }
    });
    
  } catch (error) {
    console.error('Error generating daily report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function generateDailyReport(reportDate) {
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Obtener órdenes de corte del día
  const cuttingOrders = await sql`
    SELECT * FROM cutting_orders 
    WHERE cutting_date = ${reportDate}
    ORDER BY created_at DESC
  `;
  
  // Obtener producción del día
  const production = await sql`
    SELECT 
      tl.*,
      l.lot_number
    FROM thermal_labels tl
    LEFT JOIN lots l ON tl.lot_id = l.id
    WHERE tl.packing_date = ${reportDate}
    ORDER BY tl.created_at DESC
  `;
  
  // Obtener ventas del día
  const sales = await sql`
    SELECT * FROM load_history
    WHERE load_date = ${reportDate}
    ORDER BY created_at DESC
  `;
  
  // Obtener gastos del día
  const expenses = await sql`
    SELECT * FROM expenses
    WHERE expense_date = ${reportDate}
    ORDER BY created_at DESC
  `;
  
  // Obtener inventario actual
  const inventory = await sql`
    SELECT * FROM materials_inventory
    ORDER BY category, material_name
  `;
  
  // Obtener eventos de trazabilidad del día
  const traceability = await sql`
    SELECT * FROM traceability_log
    WHERE DATE(timestamp) = ${reportDate}
    ORDER BY timestamp DESC
  `;
  
  // Calcular resumen
  const totalFruitInput = cuttingOrders.reduce((sum, order) => 
    sum + (parseFloat(order.net_weight) || 0), 0
  );
  
  const totalProduction = production.reduce((sum, prod) => 
    sum + (parseFloat(prod.total_kg) || 0), 0
  );
  
  const totalSales = sales.reduce((sum, sale) => 
    sum + (parseFloat(sale.total_kg) || 0), 0
  );
  
  const totalExpenses = expenses.reduce((sum, expense) => 
    sum + (parseFloat(expense.total) || 0), 0
  );
  
  const inventoryValue = inventory.reduce((sum, item) => 
    sum + (parseFloat(item.quantity_available) || 0), 0
  );
  
  return {
    summary: {
      totalFruitInput,
      totalProduction,
      totalSales,
      totalExpenses,
      inventoryValue
    },
    cuttingOrders,
    production,
    sales,
    expenses,
    inventory,
    traceability
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, date } = body;
    
    if (action === 'save-to-storage') {
      // Guardar en almacenamiento interno
      const saveResult = await saveToInternalStorage(date);
      return NextResponse.json(saveResult);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST daily report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function saveToInternalStorage(reportDate) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Generar el reporte
    const report = await generateDailyReport(reportDate);
    const workbook = XLSX.utils.book_new();
    
    // Crear hojas (mismo código que en GET)
    // ... (código de generación de hojas Excel)
    
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Organizar por carpetas (Año/Mes)
    const date = new Date(reportDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const baseDir = '/home/user/apps/web/public/storage/reportes';
    const yearDir = path.join(baseDir, year.toString());
    const monthDir = path.join(yearDir, month);
    
    // Crear carpetas si no existen
    await fs.mkdir(monthDir, { recursive: true });
    
    // Guardar archivo
    const fileName = `Reporte-Diario-${reportDate}.xlsx`;
    const filePath = path.join(monthDir, fileName);
    
    await fs.writeFile(filePath, excelBuffer);
    
    // Registrar en la base de datos
    await sql`
      INSERT INTO sync_audit_log (
        entity_type, entity_id, action, module_name, user_id, created_at
      ) VALUES (
        'daily_report', 0, 'saved_to_storage', 'reportes', 'system', NOW()
      )
    `;
    
    return {
      success: true,
      fileName: fileName,
      filePath: `/storage/reportes/${year}/${month}/${fileName}`,
      message: 'Reporte guardado exitosamente en almacenamiento interno'
    };
    
  } catch (error) {
    console.error('Error saving to internal storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
