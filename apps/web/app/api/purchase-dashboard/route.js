import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Dashboard de órdenes de compra
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let startDate = monthAgo;
    if (period === 'year') startDate = yearAgo;

    // Solicitudes del mes
    const [requestsMonth] = await sql`
      SELECT COUNT(*) as total
      FROM purchase_requests
      WHERE request_date >= ${startDate}
    `;

    // Compras autorizadas
    const [authorized] = await sql`
      SELECT COUNT(*) as total
      FROM purchase_requests
      WHERE status IN ('aprobada', 'orden de compra generada', 'material recibido')
        AND request_date >= ${startDate}
    `;

    // Compras pendientes
    const [pending] = await sql`
      SELECT COUNT(*) as total
      FROM purchase_requests
      WHERE status IN ('enviada', 'en revisión', 'solicitando cotización', 'pendiente autorización')
    `;

    // Compras rechazadas
    const [rejected] = await sql`
      SELECT COUNT(*) as total
      FROM purchase_requests
      WHERE status = 'rechazada'
        AND request_date >= ${startDate}
    `;

    // Tiempo promedio de autorización
    const [avgTime] = await sql`
      SELECT AVG(EXTRACT(DAY FROM (updated_at - request_date))) as days
      FROM purchase_requests
      WHERE status IN ('aprobada', 'orden de compra generada')
        AND request_date >= ${startDate}
    `;

    // Gasto por área
    const expensesByArea = await sql`
      SELECT 
        pr.area_name,
        COUNT(*) as requests_count,
        COALESCE(SUM(po.total), 0) as total_amount
      FROM purchase_requests pr
      LEFT JOIN purchase_orders po ON pr.id = po.request_id
      WHERE pr.request_date >= ${startDate}
      GROUP BY pr.area_name
      ORDER BY total_amount DESC
    `;

    // Gasto por proveedor
    const expensesBySupplier = await sql`
      SELECT 
        supplier_name,
        COUNT(*) as orders_count,
        SUM(total) as total_amount
      FROM purchase_orders
      WHERE order_date >= ${startDate}
      GROUP BY supplier_name
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    // Gasto mensual
    const [monthlyExpense] = await sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM purchase_orders
      WHERE order_date >= ${startDate}
    `;

    // Compras urgentes
    const [urgent] = await sql`
      SELECT COUNT(*) as total
      FROM purchase_requests
      WHERE priority = 'urgente'
        AND status NOT IN ('rechazada', 'cancelado', 'material recibido', 'cerrada')
    `;

    // Solicitudes por estatus
    const byStatus = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM purchase_requests
      WHERE request_date >= ${startDate}
      GROUP BY status
      ORDER BY count DESC
    `;

    return NextResponse.json({
      period,
      startDate,
      requestsMonth: parseInt(requestsMonth.total || 0),
      authorized: parseInt(authorized.total || 0),
      pending: parseInt(pending.total || 0),
      rejected: parseInt(rejected.total || 0),
      avgAuthorizationDays: parseFloat(avgTime.days || 0).toFixed(1),
      expensesByArea,
      expensesBySupplier,
      monthlyExpense: parseFloat(monthlyExpense.total || 0),
      urgent: parseInt(urgent.total || 0),
      byStatus
    });
  } catch (error) {
    console.error('Error fetching purchase dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
