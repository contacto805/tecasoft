import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API de trazabilidad completa
 * Obtiene todos los datos relacionados de una entidad (lote, orden, carga, etc)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Parámetros type e id son requeridos' },
        { status: 400 }
      );
    }

    let traceabilityData = {};

    switch (type) {
      case 'lot':
        traceabilityData = await getLotTraceability(parseInt(id));
        break;
      case 'cuttingOrder':
        traceabilityData = await getCuttingOrderTraceability(parseInt(id));
        break;
      case 'load':
        traceabilityData = await getLoadTraceability(parseInt(id));
        break;
      case 'expense':
        traceabilityData = await getExpenseTraceability(parseInt(id));
        break;
      default:
        return NextResponse.json(
          { error: 'Tipo no soportado' },
          { status: 400 }
        );
    }

    return NextResponse.json(traceabilityData);
  } catch (error) {
    console.error('Error in traceability API:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function getLotTraceability(lotId) {
  // Obtener información del lote
  const [lot] = await sql`SELECT * FROM lots WHERE id = ${lotId}`;
  if (!lot) throw new Error('Lote no encontrado');

  // Orden de corte
  const cuttingOrders = await sql`
    SELECT * FROM cutting_orders WHERE lot_id = ${lotId}
  `;

  // Pesajes
  const weighings = await sql`
    SELECT * FROM weighings WHERE lot_id = ${lotId} ORDER BY timestamp DESC
  `;

  // Lotificación
  const lotification = await sql`
    SELECT * FROM lotification_records WHERE lot_id = ${lotId}
  `;

  // Rendimiento
  const performance = await sql`
    SELECT * FROM lot_performance WHERE lot_id = ${lotId}
  `;

  // Inventario
  const inventory = await sql`
    SELECT * FROM lot_inventory WHERE lot_id = ${lotId}
  `;

  // Cargas
  const loads = await sql`
    SELECT lh.* FROM load_history lh
    INNER JOIN load_details ld ON lh.id = ld.load_id
    WHERE ld.lot_id = ${lotId}
  `;

  // Costos
  const costs = await sql`
    SELECT * FROM lot_cost_summary WHERE lot_id = ${lotId}
  `;

  // Precio aplicado
  const priceSnapshot = await sql`
    SELECT * FROM lot_price_snapshot WHERE lot_id = ${lotId}
  `;

  // Pagos programados
  const payments = await sql`
    SELECT * FROM payment_schedule WHERE lot_id = ${lotId}
  `;

  return {
    lot,
    cuttingOrders,
    weighings,
    lotification,
    performance,
    inventory,
    loads,
    costs,
    priceSnapshot,
    payments
  };
}

async function getCuttingOrderTraceability(orderId) {
  const [order] = await sql`SELECT * FROM cutting_orders WHERE id = ${orderId}`;
  if (!order) throw new Error('Orden no encontrada');

  const lot = order.lot_id ? await sql`SELECT * FROM lots WHERE id = ${order.lot_id}` : [];

  const boxControl = await sql`
    SELECT * FROM box_control WHERE folio LIKE ${`%${order.folio}%`}
  `;

  const crew = await sql`
    SELECT * FROM crew_weekly_closings WHERE notes LIKE ${`%${order.folio}%`}
  `;

  return {
    order,
    lot: lot[0] || null,
    boxControl,
    crew
  };
}

async function getLoadTraceability(loadId) {
  const [load] = await sql`SELECT * FROM load_history WHERE id = ${loadId}`;
  if (!load) throw new Error('Carga no encontrada');

  const details = await sql`
    SELECT ld.*, l.lot_number, l.producer, l.origin
    FROM load_details ld
    LEFT JOIN lots l ON ld.lot_id = l.id
    WHERE ld.load_id = ${loadId}
  `;

  const customer = load.customer_id 
    ? await sql`SELECT * FROM customers WHERE id = ${load.customer_id}`
    : [];

  const trailerMap = await sql`
    SELECT * FROM trailer_load_map WHERE load_id = ${loadId} ORDER BY slot_position
  `;

  const freights = await sql`
    SELECT * FROM foreign_freights WHERE load_id = ${loadId}
  `;

  const invoices = await sql`
    SELECT * FROM invoices 
    WHERE customer_name = ${load.customer_name}
    AND invoice_date::date = ${load.load_date}
  `;

  return {
    load,
    details,
    customer: customer[0] || null,
    trailerMap,
    freights,
    invoices
  };
}

async function getExpenseTraceability(expenseId) {
  const [expense] = await sql`SELECT * FROM expenses WHERE id = ${expenseId}`;
  if (!expense) throw new Error('Gasto no encontrado');

  const relatedExpenses = await sql`
    SELECT * FROM expenses 
    WHERE department = ${expense.department}
    AND expense_date::date = ${expense.expense_date}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const weeklyClosing = await sql`
    SELECT * FROM weekly_closings
    WHERE week_start_date <= ${expense.expense_date}
    AND week_end_date >= ${expense.expense_date}
  `;

  return {
    expense,
    relatedExpenses,
    weeklyClosing: weeklyClosing[0] || null
  };
}
