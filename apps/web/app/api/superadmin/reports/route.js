import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customerId = searchParams.get('customerId');
    const producerId = searchParams.get('producerId');
    const brokerId = searchParams.get('brokerId');

    let reportData = {};

    // REPORTES DE PRODUCCIÓN
    if (reportType === 'produccion') {
      let where = sql``;
      if (startDate && endDate) {
        where = sql`WHERE production_date >= ${startDate} AND production_date <= ${endDate}`;
      }

      const produccion = await sql`
        SELECT 
          pb.*,
          l.lot_number,
          l.producer,
          l.fruit_type
        FROM production_batches pb
        LEFT JOIN lots l ON pb.lot_id = l.id
        ${where}
        ORDER BY pb.production_date DESC
      `;

      reportData = {
        type: 'produccion',
        records: produccion,
        summary: {
          totalRecords: produccion.length,
          totalKg: produccion.reduce((sum, r) => sum + parseFloat(r.total_kg_packed || 0), 0)
        }
      };
    }

    // REPORTES POR CORREDOR
    if (reportType === 'corredor') {
      let where = sql``;
      if (brokerId) {
        where = sql`WHERE broker_name = ${brokerId}`;
      }
      if (startDate && endDate && brokerId) {
        where = sql`WHERE broker_name = ${brokerId} AND date >= ${startDate} AND date <= ${endDate}`;
      } else if (startDate && endDate) {
        where = sql`WHERE date >= ${startDate} AND date <= ${endDate}`;
      }

      const lotes = await sql`
        SELECT * FROM lots ${where} ORDER BY date DESC
      `;

      const totalComprado = lotes.reduce((sum, l) => sum + parseFloat(l.fruit_price || 0), 0);
      const totalVendido = lotes.reduce((sum, l) => sum + parseFloat(l.total_revenue || 0), 0);

      reportData = {
        type: 'corredor',
        records: lotes,
        summary: {
          totalLotes: lotes.length,
          totalComprado,
          totalVendido,
          utilidad: totalVendido - totalComprado
        }
      };
    }

    // REPORTES POR CLIENTE
    if (reportType === 'cliente') {
      let where = sql``;
      if (customerId) {
        where = sql`WHERE customer_id = ${parseInt(customerId)}`;
      }
      if (startDate && endDate && customerId) {
        where = sql`WHERE customer_id = ${parseInt(customerId)} AND load_date >= ${startDate} AND load_date <= ${endDate}`;
      } else if (startDate && endDate) {
        where = sql`WHERE load_date >= ${startDate} AND load_date <= ${endDate}`;
      }

      const cargas = await sql`
        SELECT * FROM load_history ${where} ORDER BY load_date DESC
      `;

      reportData = {
        type: 'cliente',
        records: cargas,
        summary: {
          totalCargas: cargas.length,
          totalKg: cargas.reduce((sum, c) => sum + parseFloat(c.total_kg || 0), 0),
          totalFacturado: cargas.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0)
        }
      };
    }

    // REPORTES POR PRODUCTOR
    if (reportType === 'productor') {
      let where = sql``;
      if (producerId) {
        where = sql`WHERE producer = ${producerId}`;
      }
      if (startDate && endDate && producerId) {
        where = sql`WHERE producer = ${producerId} AND date >= ${startDate} AND date <= ${endDate}`;
      } else if (startDate && endDate) {
        where = sql`WHERE date >= ${startDate} AND date <= ${endDate}`;
      }

      const lotes = await sql`
        SELECT * FROM lots ${where} ORDER BY date DESC
      `;

      reportData = {
        type: 'productor',
        records: lotes,
        summary: {
          totalLotes: lotes.length,
          totalKgRecibidos: lotes.reduce((sum, l) => sum + parseFloat(l.total_kg_received || 0), 0),
          totalKgProcesados: lotes.reduce((sum, l) => sum + parseFloat(l.total_kg_packed || 0), 0)
        }
      };
    }

    // REPORTES DE ACOPIO
    if (reportType === 'acopio') {
      let where = sql``;
      if (startDate && endDate) {
        where = sql`WHERE date >= ${startDate} AND date <= ${endDate}`;
      }

      const acopio = await sql`
        SELECT * FROM lots ${where} ORDER BY date DESC
      `;

      reportData = {
        type: 'acopio',
        records: acopio,
        summary: {
          totalRecepciones: acopio.length,
          totalKg: acopio.reduce((sum, a) => sum + parseFloat(a.total_kg_received || 0), 0)
        }
      };
    }

    // REPORTES DE COMPRAS
    if (reportType === 'compras') {
      let where = sql``;
      if (startDate && endDate) {
        where = sql`WHERE request_date >= ${startDate} AND request_date <= ${endDate}`;
      }

      const compras = await sql`
        SELECT * FROM purchase_requests ${where} ORDER BY request_date DESC
      `;

      reportData = {
        type: 'compras',
        records: compras,
        summary: {
          totalSolicitudes: compras.length,
          pendientes: compras.filter(c => c.status === 'pendiente').length,
          aprobadas: compras.filter(c => c.status === 'aprobada').length,
          rechazadas: compras.filter(c => c.status === 'rechazada').length
        }
      };
    }

    // REPORTES DE INVENTARIOS
    if (reportType === 'inventarios') {
      const inventario = await sql`
        SELECT * FROM materials_inventory ORDER BY material_name
      `;

      const movimientos = await sql`
        SELECT * FROM material_deductions 
        WHERE created_at >= ${startDate || '1900-01-01'} 
        AND created_at <= ${endDate || '2100-12-31'}
        ORDER BY created_at DESC
      `;

      reportData = {
        type: 'inventarios',
        inventario,
        movimientos,
        summary: {
          totalMateriales: inventario.length,
          totalMovimientos: movimientos.length,
          materialesCriticos: inventario.filter(m => m.quantity_available <= m.minimum_stock).length
        }
      };
    }

    // REPORTES FINANCIEROS
    if (reportType === 'financiero') {
      let where = sql``;
      if (startDate && endDate) {
        where = sql`WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}`;
      }

      const gastos = await sql`
        SELECT * FROM expense_records ${where} ORDER BY expense_date DESC
      `;

      const compras = await sql`
        SELECT * FROM purchase_orders 
        WHERE order_date >= ${startDate || '1900-01-01'} 
        AND order_date <= ${endDate || '2100-12-31'}
        ORDER BY order_date DESC
      `;

      reportData = {
        type: 'financiero',
        gastos,
        compras,
        summary: {
          totalGastos: gastos.reduce((sum, g) => sum + parseFloat(g.amount || 0), 0),
          totalCompras: compras.reduce((sum, c) => sum + parseFloat(c.total || 0), 0),
          totalEgresos: gastos.reduce((sum, g) => sum + parseFloat(g.amount || 0), 0) + 
                        compras.reduce((sum, c) => sum + parseFloat(c.total || 0), 0)
        }
      };
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Registrar generación de reporte
export async function POST(request) {
  try {
    const { reportType, reportName, generatedBy, parameters, fileFormat } = await request.json();

    const [log] = await sql`
      INSERT INTO report_generation_log 
      (report_type, report_name, generated_by, parameters, file_format)
      VALUES (${reportType}, ${reportName}, ${generatedBy}, ${JSON.stringify(parameters)}, ${fileFormat})
      RETURNING *
    `;

    return NextResponse.json(log);
  } catch (error) {
    console.error('Error logging report generation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
