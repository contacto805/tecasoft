import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Generar reportes ejecutivos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!reportType) {
      return NextResponse.json(
        { error: 'type es requerido' },
        { status: 400 }
      );
    }

    let reportData = {};

    switch (reportType) {
      case 'ventas':
        reportData = await sql`
          SELECT 
            load_date,
            customer_name,
            destination,
            total_kg,
            total_amount,
            currency,
            payment_status
          FROM load_history
          WHERE load_date >= ${dateFrom} AND load_date <= ${dateTo}
          ORDER BY load_date DESC
        `;
        break;

      case 'utilidades':
        reportData = await sql`
          SELECT 
            week_label,
            total_ingresos_dinero,
            total_egresos_dinero,
            resultado_dinero,
            status
          FROM weekly_closings
          WHERE week_start_date >= ${dateFrom} AND week_end_date <= ${dateTo}
          ORDER BY week_start_date DESC
        `;
        break;

      case 'gastos':
        reportData = await sql`
          SELECT 
            folio,
            expense_date,
            concept,
            amount,
            status,
            user_name,
            area_id
          FROM expense_records
          WHERE expense_date >= ${dateFrom} AND expense_date <= ${dateTo}
          ORDER BY expense_date DESC
        `;
        break;

      case 'flujo-efectivo':
        const ingresos = await sql`
          SELECT 
            load_date as date,
            'ingreso' as type,
            customer_name as description,
            total_amount as amount
          FROM load_history
          WHERE load_date >= ${dateFrom} AND load_date <= ${dateTo}
            AND payment_status = 'pagado'
        `;

        const egresos = await sql`
          SELECT 
            expense_date as date,
            'egreso' as type,
            concept as description,
            amount
          FROM expense_records
          WHERE expense_date >= ${dateFrom} AND expense_date <= ${dateTo}
            AND status = 'aprobado'
        `;

        reportData = [...ingresos, ...egresos].sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        break;

      case 'cobranza':
        reportData = await sql`
          SELECT 
            ca.trip_date,
            ca.customer_id,
            c.customer_name,
            ca.description,
            ca.amount_usd,
            ca.transaction_type
          FROM customer_accounts ca
          LEFT JOIN customers c ON ca.customer_id = c.id
          WHERE ca.trip_date >= ${dateFrom} AND ca.trip_date <= ${dateTo}
          ORDER BY ca.trip_date DESC
        `;
        break;

      case 'productividad':
        reportData = await sql`
          SELECT 
            l.lot_number,
            l.producer,
            l.date,
            l.total_kg_received,
            l.total_kg_packed,
            l.total_kg_sold,
            l.net_profit,
            CASE 
              WHEN l.total_kg_received > 0 
              THEN (l.total_kg_packed / l.total_kg_received * 100)
              ELSE 0 
            END as rendimiento_porcentaje
          FROM lots l
          WHERE l.date >= ${dateFrom} AND l.date <= ${dateTo}
          ORDER BY l.date DESC
        `;
        break;

      case 'recursos-humanos':
        reportData = await sql`
          SELECT 
            employee_name,
            COUNT(*) as dias_trabajados,
            SUM(hours_worked) as horas_totales,
            COUNT(CASE WHEN is_manual THEN 1 END) as registros_manuales
          FROM attendance_records
          WHERE date >= ${dateFrom} AND date <= ${dateTo}
          GROUP BY employee_name
          ORDER BY employee_name
        `;
        break;

      case 'operaciones':
        reportData = await sql`
          SELECT 
            l.lot_number,
            l.producer,
            l.date,
            l.status,
            l.total_kg_received,
            l.total_cost,
            l.total_revenue,
            l.net_profit
          FROM lots l
          WHERE l.date >= ${dateFrom} AND l.date <= ${dateTo}
          ORDER BY l.date DESC
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Tipo de reporte no válido' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      reportType,
      dateFrom,
      dateTo,
      data: reportData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Guardar reporte ejecutivo
export async function POST(request) {
  try {
    const {
      reportType,
      reportName,
      reportPeriod,
      startDate,
      endDate,
      data,
      generatedBy
    } = await request.json();

    if (!reportType || !reportName || !generatedBy) {
      return NextResponse.json(
        { error: 'reportType, reportName y generatedBy son requeridos' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO executive_reports (
        report_type,
        report_name,
        report_period,
        start_date,
        end_date,
        data,
        generated_by,
        status
      )
      VALUES (
        ${reportType},
        ${reportName},
        ${reportPeriod || 'custom'},
        ${startDate},
        ${endDate},
        ${JSON.stringify(data)},
        ${generatedBy},
        'generado'
      )
      RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
