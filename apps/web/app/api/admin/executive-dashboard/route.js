import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Dashboard ejecutivo con indicadores en tiempo real
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Safe query helper
    const safeQuery = async (q, fallback = [{ total: 0 }]) => {
      try { return await sql(q); } catch (e) { return fallback; }
    };

    // Total de ventas del día
    const ventasDia = await safeQuery(sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM load_history WHERE load_date = ${today}`);

    // Total de ventas de la semana
    const ventasSemana = await safeQuery(sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM load_history WHERE load_date >= ${weekStartStr}`);

    // Total de ventas del mes
    const ventasMes = await safeQuery(sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM load_history WHERE load_date >= ${monthStartStr}`);

    // Cuentas por cobrar
    const cuentasPorCobrar = await safeQuery(sql`SELECT COALESCE(SUM(amount_usd), 0) as total FROM customer_accounts WHERE transaction_type = 'debit' AND description LIKE '%pendiente%'`);

    // Cuentas por pagar
    const cuentasPorPagar = await safeQuery(sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM producer_payments WHERE payment_status = 'pendiente'`);

    // Saldo bancario consolidado (placeholder)
    const saldoBancario = await safeQuery(sql`SELECT COALESCE(SUM(bancos), 0) as total FROM weekly_closings ORDER BY week_start_date DESC LIMIT 1`);

    // Préstamos pendientes (desde authorization_requests)
    const prestamosPendientes = await safeQuery(sql`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM authorization_requests WHERE request_type = 'prestamo' AND status = 'pendiente'`, [{ count: 0, total: 0 }]);

    // Anticipos pendientes
    const anticiposPendientes = await safeQuery(sql`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM authorization_requests WHERE request_type = 'anticipo' AND status = 'pendiente'`, [{ count: 0, total: 0 }]);

    // Solicitudes por autorizar
    const solicitudesPorAutorizar = await safeQuery(sql`SELECT COUNT(*) as count FROM authorization_requests WHERE status = 'pendiente'`, [{ count: 0 }]);

    // Permisos pendientes
    const permisosPendientes = await safeQuery(sql`SELECT COUNT(*) as count FROM authorization_requests WHERE request_type = 'permiso' AND status = 'pendiente'`, [{ count: 0 }]);

    // Modificaciones pendientes
    const modificacionesPendientes = await safeQuery(sql`SELECT COUNT(*) as count FROM pending_changes WHERE status = 'pendiente'`, [{ count: 0 }]);

    // Viajes activos
    const viajesActivos = await safeQuery(sql`SELECT COUNT(*) as count FROM customer_trips WHERE status = 'activo'`, [{ count: 0 }]);

    // Viajes finalizados (hoy)
    const viajesFinalizados = await safeQuery(sql`SELECT COUNT(*) as count FROM customer_trips WHERE status = 'finalizado' AND trip_date = ${today}`, [{ count: 0 }]);

    // Alertas críticas
    const alertasCriticas = await safeQuery(sql`SELECT COUNT(*) as count FROM system_alerts WHERE priority = 'alta' AND status = 'activa'`, [{ count: 0 }]);

    // Resumen por módulos - safe
    const totalClientes = await safeQuery(sql`SELECT COUNT(*) as count FROM customers`, [{ count: 0 }]);
    const totalVentas = await safeQuery(sql`SELECT COUNT(*) as count FROM load_history`, [{ count: 0 }]);
    const totalOperaciones = await safeQuery(sql`SELECT COUNT(*) as count FROM lots WHERE status != 'cancelado'`, [{ count: 0 }]);
    const totalRH = await safeQuery(sql`SELECT COUNT(DISTINCT employee_id) as count FROM attendance_records`, [{ count: 0 }]);
    const totalGastos = await safeQuery(sql`SELECT COUNT(*) as count FROM expense_records`, [{ count: 0 }]);
    const totalCierres = await safeQuery(sql`SELECT COUNT(*) as count FROM weekly_closings`, [{ count: 0 }]);
    const totalInventario = await safeQuery(sql`SELECT COUNT(*) as count FROM lot_inventory`, [{ count: 0 }]);

    return NextResponse.json({
      indicadores: {
        ventasDia: parseFloat(ventasDia[0]?.total || 0),
        ventasSemana: parseFloat(ventasSemana[0]?.total || 0),
        ventasMes: parseFloat(ventasMes[0]?.total || 0),
        cuentasPorCobrar: parseFloat(cuentasPorCobrar[0]?.total || 0),
        cuentasPorPagar: parseFloat(cuentasPorPagar[0]?.total || 0),
        saldoBancario: parseFloat(saldoBancario[0]?.total || 0),
        prestamosPendientes: {
          count: parseInt(prestamosPendientes[0]?.count || 0),
          total: parseFloat(prestamosPendientes[0]?.total || 0)
        },
        anticiposPendientes: {
          count: parseInt(anticiposPendientes[0]?.count || 0),
          total: parseFloat(anticiposPendientes[0]?.total || 0)
        },
        solicitudesPorAutorizar: parseInt(solicitudesPorAutorizar[0]?.count || 0),
        permisosPendientes: parseInt(permisosPendientes[0]?.count || 0),
        modificacionesPendientes: parseInt(modificacionesPendientes[0]?.count || 0),
        viajesActivos: parseInt(viajesActivos[0]?.count || 0),
        viajesFinalizados: parseInt(viajesFinalizados[0]?.count || 0),
        alertasCriticas: parseInt(alertasCriticas[0]?.count || 0)
      },
      resumenModulos: {
        clientes: parseInt(totalClientes[0]?.count || 0),
        ventas: parseInt(totalVentas[0]?.count || 0),
        operaciones: parseInt(totalOperaciones[0]?.count || 0),
        recursosHumanos: parseInt(totalRH[0]?.count || 0),
        gastos: parseInt(totalGastos[0]?.count || 0),
        cierres: parseInt(totalCierres[0]?.count || 0),
        inventarios: parseInt(totalInventario[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching executive dashboard:', error);
    // Return full safe defaults on any error
    return NextResponse.json({
      indicadores: { ventasDia:0, ventasSemana:0, ventasMes:0, cuentasPorCobrar:0, cuentasPorPagar:0, saldoBancario:0, prestamosPendientes:{count:0,total:0}, anticiposPendientes:{count:0,total:0}, solicitudesPorAutorizar:0, permisosPendientes:0, modificacionesPendientes:0, viajesActivos:0, viajesFinalizados:0, alertasCriticas:0 },
      resumenModulos: { clientes:0, ventas:0, operaciones:0, recursosHumanos:0, gastos:0, cierres:0, inventarios:0 }
    });
  }
}
