import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

function safeNumber(n) {
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0,10); } catch { return '—'; }
}

export async function GET() {
  const now = new Date().toISOString();
  try {
    // ========== PAGOS PENDIENTES (egresos por liquidar) ==========

    // 1. Pagos a productores
    const prodPayments = await sql`
      SELECT 
        id, lot_id, producer_name, total_kg_received, total_amount, 
        scheduled_payment_date, payment_status, notes,
        'pago_productor' as cat
      FROM producer_payments 
      WHERE LOWER(COALESCE(payment_status, 'pendiente')) LIKE '%pend%' 
         OR LOWER(COALESCE(payment_status, '')) = 'pendiente'
      ORDER BY COALESCE(scheduled_payment_date, created_at) DESC 
      LIMIT 200
    `;
    const totalProd = prodPayments.reduce((s, r) => s + safeNumber(r.total_amount), 0);

    // 2. Fletes foráneos (saldo pendiente)
    const freights = await sql`
      SELECT 
        id, lot_id, load_id, driver_name, freight_amount, amount_paid, 
        due_date, payment_status, status,
        (COALESCE(freight_amount,0) - COALESCE(amount_paid,0)) as saldo_pend
      FROM foreign_freights 
      WHERE LOWER(COALESCE(payment_status, status, 'pendiente')) NOT LIKE '%pag%'
      ORDER BY COALESCE(due_date, freight_date, created_at) DESC
      LIMIT 200
    `;
    const totalFletes = freights.reduce((s, r) => s + Math.max(0, safeNumber(r.saldo_pend)), 0);

    // 3. Gastos / expenses - EXCLUIDOS del cálculo de balance al día.
    // Los gastos se registran al momento de incurrir (no son "pendientes programados").
    // Se mantiene la lista para trazabilidad, pero NO se suman al total de egresos pendientes.
    const gastos = await sql`
      SELECT id, product_name, concept, total, expense_date, department, notes 
      FROM expenses 
      ORDER BY expense_date DESC 
      LIMIT 200
    `;
    const totalGastos = 0; // Intencionalmente no sumado al balance pendiente.

    // 4. Costos operativos pendientes
    const opCosts = await sql`
      SELECT id, folio, cost_concept, description, amount_mxn, cost_date, status, lot_id 
      FROM operating_costs 
      WHERE LOWER(COALESCE(status,'pendiente')) LIKE '%pend%'
      ORDER BY cost_date DESC 
      LIMIT 100
    `;
    const totalOp = opCosts.reduce((s, r) => s + safeNumber(r.amount_mxn), 0);

    // 5. Nómina pendiente
    const payrolls = await sql`
      SELECT id, folio, week_start_date, week_end_date, total_amount, status 
      FROM payroll_periods 
      WHERE LOWER(COALESCE(status,'pendiente')) LIKE '%pend%' 
      ORDER BY week_start_date DESC 
      LIMIT 50
    `;
    const totalNomina = payrolls.reduce((s, r) => s + safeNumber(r.total_amount), 0);

    // 6. Préstamos pendientes (saldo restante)
    const loans = await sql`
      SELECT 
        id, employee_id, employee_name, folio, amount, remaining_balance, 
        descuento_semanal, status, fecha_prestamo 
      FROM employee_loans 
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const loansPend = loans.map(l => {
      const rem = Math.max(0, safeNumber(l.remaining_balance || l.amount));
      return { ...l, saldo_calc: rem };
    });
    const totalPrestamos = loansPend.reduce((s, r) => s + r.saldo_calc, 0);

    // 7. Programación pagos (payment_schedule pendientes)
    const sched = await sql`
      SELECT id, folio, producer_name, concept, amount, due_date, scheduled_payment_date, status 
      FROM payment_schedule 
      WHERE LOWER(COALESCE(status,'scheduled')) NOT LIKE '%pag%' 
        AND LOWER(COALESCE(status,'scheduled')) NOT LIKE '%liquid%'
      ORDER BY COALESCE(scheduled_payment_date, due_date) DESC 
      LIMIT 100
    `;
    const totalSched = sched.reduce((s, r) => s + safeNumber(r.amount), 0);

    // ========== COBROS PENDIENTES (ingresos por cobrar) ==========

    // 1. Ventas proceso y desecho (pendientes)
    const ventas = await sql`
      SELECT 
        id, lot_id, buyer_name, product_name, total_price, payment_status, date, notes, 
        process_kg, waste_kg
      FROM sales_of_process_and_waste 
      WHERE LOWER(COALESCE(payment_status,'pendiente')) LIKE '%pend%'
      ORDER BY COALESCE(date, created_at) DESC 
      LIMIT 200
    `;
    const totalVentasPend = ventas.reduce((s, r) => s + safeNumber(r.total_price), 0);

    // 2. Cargas / load_history (ventas pendientes)
    const cargas = await sql`
      SELECT id, load_date, customer_name, destination, total_kg, total_amount, payment_status, notes 
      FROM load_history 
      WHERE LOWER(COALESCE(payment_status, 'pendiente')) LIKE '%pend%' OR payment_status IS NULL
      ORDER BY load_date DESC 
      LIMIT 200
    `;
    const totalCargas = cargas.reduce((s, r) => s + safeNumber(r.total_amount), 0);

    // 3. Viajes / customer trips con saldo
    const cTrips = await sql`
      SELECT 
        ct.id, ct.customer_id, ct.trip_date, ct.total_kg, ct.boxes_count, ct.price_per_trip, ct.currency,
        ct.notes, c.customer_name,
        (COALESCE(ct.price_per_trip,0) - COALESCE((SELECT SUM(amount_paid) FROM customer_trip_payments WHERE customer_trip_id = ct.id),0)) as saldo_pend
      FROM customer_trips ct
      LEFT JOIN customers c ON ct.customer_id = c.id
      WHERE ct.status IN ('pending','activo') OR ct.status IS NULL
      ORDER BY ct.trip_date DESC 
      LIMIT 100
    `;
    const totalViajes = cTrips.reduce((s, r) => s + Math.max(0, safeNumber(r.saldo_pend)), 0);

    // 4. Customer accounts pendientes (debits no cubiertos)
    const custAcc = await sql`
      SELECT ca.id, ca.customer_id, ca.description, ca.amount_usd, ca.amount_mxn, ca.transaction_type, ca.trip_date, c.customer_name 
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE (ca.transaction_type ILIKE '%debit%' OR ca.transaction_type ILIKE '%receiv%')
      ORDER BY ca.trip_date DESC LIMIT 100
    `;
    const totalCustAcc = custAcc.reduce((s, r) => s + safeNumber(r.amount_usd || r.amount_mxn), 0);

    // Totals
    const totalPagos = safeNumber(totalProd) + safeNumber(totalFletes) + safeNumber(totalOp) +
                       safeNumber(totalNomina) + safeNumber(totalPrestamos) + safeNumber(totalSched);
    // NOTA: gastos NO se incluyen en totalPagos (son registrados, no "pendientes programados" para flujo al día)

    const totalCobros = safeNumber(totalVentasPend) + safeNumber(totalCargas) + safeNumber(totalViajes) + safeNumber(totalCustAcc);

    const balance = totalCobros - totalPagos;

    // Build detailed tracable arrays 
    const pagosDetalles = [
      ...prodPayments.map(r => ({
        id: r.id, tipo: 'Pago a Productor', fuente: 'producer_payments', origen: '/producer-payments',
        descripcion: `${r.producer_name || 'Productor'} - Lote ID ${r.lot_id} (${r.total_kg_received || 0} kg)`,
        monto: safeNumber(r.total_amount), fecha: fmtDate(r.scheduled_payment_date), estado: r.payment_status,
        trazabilidad: { lote_id: r.lot_id, productor: r.producer_name }
      })),
      ...freights.map(r => ({
        id: r.id, tipo: 'Flete', fuente: 'foreign_freights', origen: '/control-fletes',
        descripcion: `${r.driver_name || 'Transportista'} - Due ${fmtDate(r.due_date) || ''}`,
        monto: Math.max(0, safeNumber(r.saldo_pend)), fecha: fmtDate(r.due_date), estado: r.payment_status || r.status,
        trazabilidad: { lote_id: r.lot_id, load_id: r.load_id }
      })),
      // Gastos (expenses) excluidos intencionalmente de detalles pagos pendientes.
      // Los gastos se registran al momento, no forman parte de compromisos pendientes del Balance al día.
      ...opCosts.map(r => ({
        id: r.id, tipo: 'Costo Operativo', fuente: 'operating_costs', origen: '/costos-operativos',
        descripcion: r.cost_concept || r.description, monto: safeNumber(r.amount_mxn), fecha: fmtDate(r.cost_date),
        estado: r.status, trazabilidad: { lote_id: r.lot_id }
      })),
      ...payrolls.map(r => ({
        id: r.id, tipo: 'Nómina', fuente: 'payroll', origen: '/nomina',
        descripcion: `Nómina ${r.folio || ''} (${fmtDate(r.week_start_date)} - ${fmtDate(r.week_end_date)})`, 
        monto: safeNumber(r.total_amount), fecha: fmtDate(r.week_start_date), estado: r.status, trazabilidad: {}
      })),
      ...loansPend.map(r => ({
        id: r.id, tipo: 'Préstamo / Anticipo', fuente: 'prestamos', origen: '/prestamos',
        descripcion: `${r.employee_name || 'Empleado'} ${r.folio || ''}`, monto: r.saldo_calc,
        fecha: fmtDate(r.fecha_prestamo), estado: r.status || 'Pendiente', 
        trazabilidad: { empleado: r.employee_id }
      })),
      ...sched.map(r => ({
        id: r.id, tipo: 'Programación Pago', fuente: 'payment_schedule', origen: '/programacion-pagos',
        descripcion: `${r.producer_name || ''} ${r.concept || ''}`, monto: safeNumber(r.amount),
        fecha: fmtDate(r.scheduled_payment_date), estado: r.status, trazabilidad: {}
      })),
    ];

    const cobrosDetalles = [
      ...ventas.map(r => ({
        id: r.id, tipo: r.product_name || 'Proceso/Desecho', fuente: 'sales_proceso_desecho', origen: '/sales-process-waste',
        descripcion: `${r.buyer_name || ''} - ${r.product_name} ${(r.process_kg||0)+(r.waste_kg||0)}kg`,
        monto: safeNumber(r.total_price), fecha: fmtDate(r.date), estado: r.payment_status, 
        trazabilidad: { lote_id: r.lot_id, buyer: r.buyer_name }
      })),
      ...cargas.map(r => ({
        id: r.id, tipo: 'Carga / Venta', fuente: 'load_history', origen: '/embarques',
        descripcion: `${r.customer_name || ''} → ${r.destination || ''} (${r.total_kg}kg)`,
        monto: safeNumber(r.total_amount), fecha: fmtDate(r.load_date), estado: r.payment_status || 'Pendiente',
        trazabilidad: { cliente: r.customer_name }
      })),
      ...cTrips.filter(r => safeNumber(r.saldo_pend) > 0).map(r => ({
        id: r.id, tipo: 'Viaje Cliente', fuente: 'customer_trips', origen: '/customers',
        descripcion: `${r.customer_name || ''} ${r.total_kg || 0}kg`, monto: safeNumber(r.saldo_pend),
        fecha: fmtDate(r.trip_date), estado: 'Pendiente', 
        trazabilidad: { cliente_id: r.customer_id }
      })),
      ...custAcc.map(r => ({
        id: r.id, tipo: 'Cuenta Cliente', fuente: 'customer_accounts', origen: '/customers',
        descripcion: `${r.customer_name || ''} ${r.description || ''}`, 
        monto: safeNumber(r.amount_usd || r.amount_mxn),
        fecha: fmtDate(r.trip_date), estado: 'Pendiente', trazabilidad: {}
      })),
    ];

    return NextResponse.json({
      total_pagos_pendientes: Math.round(totalPagos * 100) / 100,
      total_cobros_pendientes: Math.round(totalCobros * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      ultima_actualizacion: now,
      detalles: {
        pagos: pagosDetalles,
        cobros: cobrosDetalles,
        desglose: {
          pagos: {
            productores: { total: Math.round(totalProd*100)/100, registros: prodPayments.length },
            fletes: { total: Math.round(totalFletes*100)/100, registros: freights.length },
            gastos: { total: 0, registros: 0, nota: 'excluidos del balance (gastos se registran al momento)' },
            costos_operativos: { total: Math.round(totalOp*100)/100, registros: opCosts.length },
            nomina: { total: Math.round(totalNomina*100)/100, registros: payrolls.length },
            prestamos: { total: Math.round(totalPrestamos*100)/100, registros: loansPend.length },
            programados: { total: Math.round(totalSched*100)/100, registros: sched.length }
          },
          cobros: {
            proceso_desecho: { total: Math.round(totalVentasPend*100)/100, registros: ventas.length },
            cargas_ventas: { total: Math.round(totalCargas*100)/100, registros: cargas.length },
            viajes: { total: Math.round(totalViajes*100)/100, registros: cTrips.length },
            cuentas_clientes: { total: Math.round(totalCustAcc*100)/100, registros: custAcc.length }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error en Balance al día:', error);
    return NextResponse.json({
      total_pagos_pendientes: 0,
      total_cobros_pendientes: 0,
      balance: 0,
      ultima_actualizacion: now,
      error: error.message,
      detalles: { pagos: [], cobros: [], desglose: {} }
    });
  }
}
