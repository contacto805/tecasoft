import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    const yearStartStr = yearStart.toISOString().split('T')[0];

    // PRODUCCIÓN
    const [produccionDiaria] = await sql`
      SELECT COALESCE(SUM(total_kg_packed), 0) as total
      FROM lots
      WHERE date = ${today}
    `;

    const [produccionSemanal] = await sql`
      SELECT COALESCE(SUM(total_kg_packed), 0) as total
      FROM lots
      WHERE date >= ${weekStartStr}
    `;

    const [produccionMensual] = await sql`
      SELECT COALESCE(SUM(total_kg_packed), 0) as total
      FROM lots
      WHERE date >= ${monthStartStr}
    `;

    const [produccionAnual] = await sql`
      SELECT COALESCE(SUM(total_kg_packed), 0) as total
      FROM lots
      WHERE date >= ${yearStartStr}
    `;

    // COMPRAS
    const [comprasAutorizadas] = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM purchase_orders
      WHERE status = 'autorizada'
    `;

    const [comprasPendientes] = await sql`
      SELECT COUNT(*) as count, COALESCE(0, 0) as total
      FROM purchase_requests
      WHERE status IN ('enviada', 'en_revision', 'cotizacion_recibida')
    `;

    const [comprasRechazadas] = await sql`
      SELECT COUNT(*) as count
      FROM purchase_requests
      WHERE status = 'rechazada'
    `;

    // INVENTARIOS
    const [inventarioActual] = await sql`
      SELECT COALESCE(SUM(total_kg), 0) as total_kg
      FROM lot_inventory
    `;

    const [materialesCriticos] = await sql`
      SELECT COUNT(*) as count
      FROM materials_inventory
      WHERE quantity_available <= minimum_stock
    `;

    const [materialesAgotados] = await sql`
      SELECT COUNT(*) as count
      FROM materials_inventory
      WHERE quantity_available = 0
    `;

    // FINANZAS
    const [gastosDiarios] = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE expense_date = ${today}
    `;

    const [gastosSemanales] = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE expense_date >= ${weekStartStr}
    `;

    const [gastosMensuales] = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE expense_date >= ${monthStartStr}
    `;

    const [gastosAnuales] = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE expense_date >= ${yearStartStr}
    `;

    // RECURSOS HUMANOS
    const [personalActivo] = await sql`
      SELECT COUNT(DISTINCT employee_id) as count
      FROM attendance_records
      WHERE date >= ${weekStartStr}
    `;

    const [prestamosActivos] = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM employee_loans
      WHERE status IN ('aprobado', 'pendiente')
    `;

    const [permisosPendientes] = await sql`
      SELECT COUNT(*) as count
      FROM authorization_requests
      WHERE request_type IN ('permiso', 'vacaciones') AND status = 'pendiente'
    `;

    // OPERACIÓN
    const [lotesActivos] = await sql`
      SELECT COUNT(*) as count
      FROM lots
      WHERE status IN ('activo', 'en_proceso')
    `;

    const [lotesCerrados] = await sql`
      SELECT COUNT(*) as count
      FROM lots
      WHERE status = 'cerrado'
    `;

    const [embarquesProgramados] = await sql`
      SELECT COUNT(*) as count
      FROM customer_trips
      WHERE status IN ('programado', 'en_transito')
    `;

    return NextResponse.json({
      produccion: {
        diaria: parseFloat(produccionDiaria.total || 0),
        semanal: parseFloat(produccionSemanal.total || 0),
        mensual: parseFloat(produccionMensual.total || 0),
        anual: parseFloat(produccionAnual.total || 0)
      },
      compras: {
        autorizadas: {
          count: parseInt(comprasAutorizadas.count || 0),
          total: parseFloat(comprasAutorizadas.total || 0)
        },
        pendientes: {
          count: parseInt(comprasPendientes.count || 0),
          total: parseFloat(comprasPendientes.total || 0)
        },
        rechazadas: parseInt(comprasRechazadas.count || 0)
      },
      inventarios: {
        totalKg: parseFloat(inventarioActual.total_kg || 0),
        materialesCriticos: parseInt(materialesCriticos.count || 0),
        materialesAgotados: parseInt(materialesAgotados.count || 0)
      },
      finanzas: {
        gastosDiarios: parseFloat(gastosDiarios.total || 0),
        gastosSemanales: parseFloat(gastosSemanales.total || 0),
        gastosMensuales: parseFloat(gastosMensuales.total || 0),
        gastosAnuales: parseFloat(gastosAnuales.total || 0)
      },
      recursosHumanos: {
        personalActivo: parseInt(personalActivo.count || 0),
        prestamosActivos: {
          count: parseInt(prestamosActivos.count || 0),
          total: parseFloat(prestamosActivos.total || 0)
        },
        permisosPendientes: parseInt(permisosPendientes.count || 0)
      },
      operacion: {
        lotesActivos: parseInt(lotesActivos.count || 0),
        lotesCerrados: parseInt(lotesCerrados.count || 0),
        embarquesProgramados: parseInt(embarquesProgramados.count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching superadmin dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
