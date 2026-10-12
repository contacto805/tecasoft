import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Usuarios
    const usersRes = await sql`SELECT COUNT(*)::int as count FROM "user"`;
    const usersCount = usersRes[0]?.count || 0;

    // Super admins
    const supersRes = await sql`SELECT COUNT(*)::int as count FROM "user" WHERE is_super_admin = true`;
    const superCount = supersRes[0]?.count || 0;

    // Grupos activos
    const groupsRes = await sql`SELECT COUNT(*)::int as count FROM menu_groups WHERE is_active = true`;
    const groupsCount = groupsRes[0]?.count || 0;

    // Módulos activos
    const modulesRes = await sql`SELECT COUNT(*)::int as count FROM menu_modules WHERE is_active = true`;
    const modulesCount = modulesRes[0]?.count || 0;

    // Ventas ultimos 7 días (total monto)
    const ventas7Res = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::numeric as total, COUNT(*)::int as cnt 
      FROM load_history 
      WHERE load_date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    const ventas7 = parseFloat(ventas7Res[0]?.total || 0);
    const cargas7 = ventas7Res[0]?.cnt || 0;

    // Clientes totales
    const clientsRes = await sql`SELECT COUNT(*)::int as count FROM customers`;
    const clientsCount = clientsRes[0]?.count || 0;

    // Total cargas histórico
    const loadsRes = await sql`SELECT COUNT(*)::int as count FROM load_history`;
    const loadsTotal = loadsRes[0]?.count || 0;

    // Cierre semanal activo
    const closingRes = await sql`
      SELECT week_label, COALESCE(total_cargas_dinero,0)::numeric as dinero, COALESCE(resultado_dinero,0)::numeric as resultado 
      FROM weekly_closings 
      ORDER BY week_start_date DESC 
      LIMIT 1
    `;
    const currentClosing = closingRes[0] || { week_label: 'Sin cierre', dinero: 0, resultado: 0 };

    // Pedidos recientes (ultimos 5)
    const pedidosRes = await sql`
      SELECT load_date, customer_name, total_kg, total_amount, factura_folio 
      FROM load_history 
      ORDER BY load_date DESC, created_at DESC 
      LIMIT 5
    `;

    return NextResponse.json({
      users: usersCount,
      superAdmins: superCount,
      groups: groupsCount,
      modules: modulesCount,
      ventasWeek: ventas7,
      cargasWeek: cargas7,
      clients: clientsCount,
      totalLoads: loadsTotal,
      closing: currentClosing || { week_label: '—', dinero: 0 },
      recentPedidos: Array.isArray(pedidosRes) ? pedidosRes : [],
    });
  } catch (e) {
    console.error('superadmin summary error', e);
    return NextResponse.json({
      users: 0, superAdmins: 0, groups: 0, modules: 0,
      ventasWeek: 0, cargasWeek: 0, clients: 0, totalLoads: 0,
      closing: { week_label: 'Sin datos', dinero: 0, resultado: 0 }, recentPedidos: []
    });
  }
}
