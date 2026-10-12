import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const records = await sql`
      SELECT * FROM employee_loans 
      ORDER BY created_at DESC 
      LIMIT 100
    `;
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { employee_id, employee_name, loan_type, total_amount, interest_rate, months, status } = body;

    const result = await sql`
      INSERT INTO employee_loans 
      (employee_id, employee_name, loan_type, total_amount, remaining_balance, interest_rate, months, status)
      VALUES (${employee_id}, ${employee_name}, ${loan_type}, ${total_amount}, ${total_amount}, ${interest_rate}, ${months}, ${status || 'active'})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
