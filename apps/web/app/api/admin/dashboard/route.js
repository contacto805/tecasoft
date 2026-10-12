import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getMexicoCityTime } from "@/app/api/utils/mexico-time";

// GET - Obtener indicadores del dashboard ejecutivo
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today'; // today, week, month

    const { date: today } = getMexicoCityTime();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let startDate = today;
    if (period === 'week') startDate = weekAgo;
    if (period === 'month') startDate = monthAgo;

    // Ventas del período
    const [salesData] = await sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as total_loads
      FROM load_history
      WHERE load_date >= ${startDate}
    `;

    // Cuentas por cobrar
    const [accountsReceivable] = await sql`
      SELECT COALESCE(SUM(amount_usd), 0) as total
      FROM customer_accounts
      WHERE transaction_type = 'cargo'
        AND created_at >= ${startDate}
    `;

    // Cuentas por pagar
    const [accountsPayable] = await sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as producer_payments
      FROM producer_payments
      WHERE payment_status = 'pendiente'
    `;

    // Gastos del período
    const [expensesData] = await sql`
      SELECT COALESCE(SUM(total), 0) as total_expenses
      FROM expenses
      WHERE expense_date >= ${startDate}
    `;

    // Anticipos pendientes
    const anticiposPendientes = await sql`
      SELECT COUNT(*) as count
      FROM authorization_requests
      WHERE request_type = 'anticipo'
        AND status = 'pendiente'
    `;

    // Préstamos pendientes
    const prestamosPendientes = await sql`
      SELECT COUNT(*) as count
      FROM authorization_requests
      WHERE request_type = 'prestamo'
        AND status = 'pendiente'
    `;

    // Solicitudes por autorizar
    const [pendingAuthorizations] = await sql`
      SELECT COUNT(*) as total
      FROM authorization_requests
      WHERE status = 'pendiente'
    `;

    // Permisos pendientes
    const [pendingPermissions] = await sql`
      SELECT COUNT(*) as total
      FROM authorization_requests
      WHERE request_type IN ('permiso', 'vacaciones', 'incapacidad')
        AND status = 'pendiente'
    `;

    // Modificaciones pendientes
    const [pendingChanges] = await sql`
      SELECT COUNT(*) as total
      FROM pending_changes
      WHERE status = 'pendiente'
    `;

    // Viajes activos (loads activos o en tránsito)
    const [activeTrips] = await sql`
      SELECT COUNT(*) as total
      FROM customer_trips
      WHERE status IN ('activo', 'en_transito')
    `;

    // Viajes finalizados del período
    const [completedTrips] = await sql`
      SELECT COUNT(*) as total
      FROM customer_trips
      WHERE status = 'finalizado'
        AND trip_date >= ${startDate}
    `;

    // Alertas críticas
    const [criticalAlerts] = await sql`
      SELECT COUNT(*) as total
      FROM system_alerts
      WHERE priority = 'alta'
        AND status = 'activa'
    `;

    // Nómina semanal
    const [payrollData] = await sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_payroll,
        COUNT(*) as periods_count
      FROM payroll_periods
      WHERE week_start_date >= ${startDate}
        AND status = 'aprobado'
    `;

    // Cierres semanales pendientes
    const [pendingClosings] = await sql`
      SELECT COUNT(*) as total
      FROM weekly_closings
      WHERE status = 'pendiente'
    `;

    // Inventario total
    const [inventoryData] = await sql`
      SELECT 
        COALESCE(SUM(total_kg), 0) as total_kg_inventory
      FROM lot_inventory
    `;

    // Lotes activos
    const [activeLots] = await sql`
      SELECT COUNT(*) as total
      FROM lots
      WHERE status IN ('activo', 'en_proceso')
    `;

    return NextResponse.json({
      period,
      startDate,
      sales: {
        totalSales: parseFloat(salesData.total_sales || 0),
        totalLoads: parseInt(salesData.total_loads || 0)
      },
      accounts: {
        receivable: parseFloat(accountsReceivable.total || 0),
        payable: parseFloat(accountsPayable.producer_payments || 0)
      },
      expenses: {
        total: parseFloat(expensesData.total_expenses || 0)
      },
      authorizations: {
        pending: parseInt(pendingAuthorizations.total || 0),
        anticipos: parseInt(anticiposPendientes[0]?.count || 0),
        prestamos: parseInt(prestamosPendientes[0]?.count || 0),
        permissions: parseInt(pendingPermissions.total || 0)
      },
      changes: {
        pending: parseInt(pendingChanges.total || 0)
      },
      trips: {
        active: parseInt(activeTrips.total || 0),
        completed: parseInt(completedTrips.total || 0)
      },
      alerts: {
        critical: parseInt(criticalAlerts.total || 0)
      },
      payroll: {
        total: parseFloat(payrollData.total_payroll || 0),
        periods: parseInt(payrollData.periods_count || 0)
      },
      closings: {
        pending: parseInt(pendingClosings.total || 0)
      },
      inventory: {
        totalKg: parseFloat(inventoryData.total_kg_inventory || 0)
      },
      lots: {
        active: parseInt(activeLots.total || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({
      period: period || 'today',
      startDate: startDate || new Date().toISOString().split('T')[0],
      sales: { totalSales: 0, totalLoads: 0 },
      accounts: { receivable: 0, payable: 0 },
      expenses: { total: 0 },
      authorizations: { pending: 0, anticipos: 0, prestamos: 0, permissions: 0 },
      changes: { pending: 0 },
      trips: { active: 0, completed: 0 },
      alerts: { critical: 0 },
      payroll: { total: 0, periods: 0 },
      closings: { pending: 0 },
      inventory: { totalKg: 0 },
      lots: { active: 0 }
    });
  }
}
