import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Búsqueda global en el sistema
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const module = searchParams.get('module');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const userId = searchParams.get('userId');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    if (!query && !module) {
      return NextResponse.json(
        { error: 'Se requiere query o module' },
        { status: 400 }
      );
    }

    const results = {
      lots: [],
      customers: [],
      loads: [],
      expenses: [],
      employees: [],
      invoices: [],
      orders: []
    };

    // Si hay query, buscar en múltiples tablas
    if (query) {
      const searchTerm = `%${query}%`;

      // Buscar lotes
      const lots = await sql`
        SELECT 'lot' as type, id, lot_number as folio, producer as name, 
               date, status, total_kg_received as amount
        FROM lots
        WHERE lot_number ILIKE ${searchTerm} 
           OR producer ILIKE ${searchTerm}
           OR origin ILIKE ${searchTerm}
        ORDER BY date DESC
        LIMIT 20
      `;
      results.lots = lots;

      // Buscar clientes
      const customers = await sql`
        SELECT 'customer' as type, id, customer_name as name, 
               rfc, email, phone, destination
        FROM customers
        WHERE customer_name ILIKE ${searchTerm}
           OR rfc ILIKE ${searchTerm}
           OR email ILIKE ${searchTerm}
        LIMIT 20
      `;
      results.customers = customers;

      // Buscar cargas
      const loads = await sql`
        SELECT 'load' as type, id, customer_name as name,
               load_date as date, total_amount as amount,
               destination, status
        FROM load_history
        WHERE customer_name ILIKE ${searchTerm}
           OR destination ILIKE ${searchTerm}
        ORDER BY load_date DESC
        LIMIT 20
      `;
      results.loads = loads;

      // Buscar gastos
      const expenses = await sql`
        SELECT 'expense' as type, id, folio, concept as name,
               expense_date as date, amount, status
        FROM expense_records
        WHERE folio ILIKE ${searchTerm}
           OR concept ILIKE ${searchTerm}
           OR description ILIKE ${searchTerm}
        ORDER BY expense_date DESC
        LIMIT 20
      `;
      results.expenses = expenses;

      // Buscar facturas
      const invoices = await sql`
        SELECT 'invoice' as type, id, invoice_number as folio,
               customer_name as name, invoice_date as date,
               total as amount, status
        FROM invoices
        WHERE invoice_number ILIKE ${searchTerm}
           OR customer_name ILIKE ${searchTerm}
        ORDER BY invoice_date DESC
        LIMIT 20
      `;
      results.invoices = invoices;
    }

    // Si hay filtro de módulo específico
    if (module) {
      let where = sql``;
      
      if (dateFrom && dateTo) {
        where = sql`WHERE date >= ${dateFrom} AND date <= ${dateTo}`;
      }
      
      if (status) {
        if (where.strings && where.strings.length > 0) {
          where = sql`${where} AND status = ${status}`;
        } else {
          where = sql`WHERE status = ${status}`;
        }
      }

      switch (module) {
        case 'lots':
          results.lots = await sql`
            SELECT * FROM lots ${where} ORDER BY date DESC LIMIT 100
          `;
          break;
        case 'loads':
          const loadWhere = where.strings && where.strings.length > 0 
            ? sql`WHERE load_date >= ${dateFrom} AND load_date <= ${dateTo}` 
            : sql``;
          results.loads = await sql`
            SELECT * FROM load_history ${loadWhere} ORDER BY load_date DESC LIMIT 100
          `;
          break;
        case 'expenses':
          const expenseWhere = where.strings && where.strings.length > 0
            ? sql`WHERE expense_date >= ${dateFrom} AND expense_date <= ${dateTo}`
            : sql``;
          results.expenses = await sql`
            SELECT * FROM expense_records ${expenseWhere} ORDER BY expense_date DESC LIMIT 100
          `;
          break;
        case 'customers':
          results.customers = await sql`
            SELECT * FROM customers ORDER BY created_at DESC LIMIT 100
          `;
          break;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in global search:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
