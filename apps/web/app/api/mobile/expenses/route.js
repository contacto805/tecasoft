import {fixedExpenseType} from "@/app/api/utils/fixed-expenses";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * Mobile Expenses Sync API
 * Endpoints for mobile apps to sync expense data
 * 
 * GET /api/mobile/expenses - Get all expenses (with optional filters)
 * POST /api/mobile/expenses - Create new expense
 * PUT /api/mobile/expenses - Update expense
 * DELETE /api/mobile/expenses - Delete expense
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const syncTimestamp = searchParams.get('syncTimestamp'); // For delta sync

    let query = `SELECT 
      id,
      product_name,
      cost_per_unit,
      quantity,
      total,
      department,
      notes,
      expense_date,
      photo_url,
      created_at,
      updated_at
    FROM expenses WHERE expense_type IS DISTINCT FROM ${fixedExpenseType}`;

    const conditions = [];

    if (department && department !== 'Todos') {
      conditions.push(`department = '${department}'`);
    }

    if (startDate) {
      conditions.push(`expense_date >= '${startDate}'`);
    }

    if (endDate) {
      conditions.push(`expense_date <= '${endDate}'`);
    }

    // For delta sync - only get records modified after syncTimestamp
    if (syncTimestamp) {
      conditions.push(`updated_at > '${new Date(parseInt(syncTimestamp)).toISOString()}'`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY expense_date DESC, created_at DESC';

    const expenses = await sql`
      SELECT 
        id,
        product_name,
        cost_per_unit,
        quantity,
        total,
        department,
        notes,
        expense_date,
        photo_url,
        created_at,
        updated_at
      FROM expenses 
      ${department && department !== 'Todos' ? sql`WHERE department = ${department}` : sql``}
      ${startDate && !department ? sql`WHERE expense_date >= ${startDate}` : startDate ? sql`AND expense_date >= ${startDate}` : sql``}
      ${endDate ? sql`AND expense_date <= ${endDate}` : sql``}
      ${syncTimestamp ? sql`AND updated_at > ${new Date(parseInt(syncTimestamp)).toISOString()}` : sql``}
      ORDER BY expense_date DESC, created_at DESC
    `;

    return NextResponse.json({
      status: 'success',
      timestamp: Date.now(),
      data: expenses,
      count: expenses.length
    });
  } catch (error) {
    console.error('Error fetching expenses for mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al obtener gastos: ' + error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { productName, costPerUnit, quantity, total, department, notes, expenseDate, photoUrl } = await request.json();

    // Validation
    if (!productName || !costPerUnit || !quantity || !total || !department) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Campos requeridos faltantes: productName, costPerUnit, quantity, total, department'
        },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO expenses (product_name, cost_per_unit, quantity, total, department, notes, expense_date, photo_url, created_at, updated_at)
      VALUES (${productName}, ${parseFloat(costPerUnit)}, ${parseFloat(quantity)}, ${parseFloat(total)}, ${department}, ${notes || ''}, ${expenseDate || new Date().toISOString().split('T')[0]}, ${photoUrl || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, product_name, cost_per_unit, quantity, total, department, notes, expense_date, photo_url, created_at, updated_at
    `;

    return NextResponse.json(
      {
        status: 'success',
        message: 'Gasto creado exitosamente',
        data: result[0]
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating expense from mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al crear gasto: ' + error.message
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, productName, costPerUnit, quantity, total, department, notes, expenseDate, photoUrl } = await request.json();

    if (!id) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'ID de gasto es requerido'
        },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE expenses
      SET product_name = ${productName},
          cost_per_unit = ${parseFloat(costPerUnit)},
          quantity = ${parseFloat(quantity)},
          total = ${parseFloat(total)},
          department = ${department},
          notes = ${notes || ''},
          expense_date = ${expenseDate},
          photo_url = ${photoUrl || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)} AND expense_type IS DISTINCT FROM ${fixedExpenseType}
      RETURNING id, product_name, cost_per_unit, quantity, total, department, notes, expense_date, photo_url, created_at, updated_at
    `;

    if (result.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Gasto no encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Gasto actualizado exitosamente',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating expense from mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al actualizar gasto: ' + error.message
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'ID de gasto es requerido'
        },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM expenses
      WHERE id = ${parseInt(id)} AND expense_type IS DISTINCT FROM ${fixedExpenseType}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Gasto no encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Gasto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting expense from mobile:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error al eliminar gasto: ' + error.message
      },
      { status: 500 }
    );
  }
}
