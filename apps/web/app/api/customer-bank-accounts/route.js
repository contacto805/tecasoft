import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const id = searchParams.get("id");

    if (id) {
      const rows = await sql`SELECT * FROM customer_bank_accounts WHERE id = ${parseInt(id)} LIMIT 1`;
      return NextResponse.json(rows[0] || null);
    }

    if (customerId) {
      const rows = await sql`
        SELECT * FROM customer_bank_accounts 
        WHERE customer_id = ${parseInt(customerId)} 
        ORDER BY is_primary DESC, created_at DESC
      `;
      return NextResponse.json(rows);
    }

    const rows = await sql`SELECT * FROM customer_bank_accounts ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener cuentas bancarias" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { customer_id, bank_name, account_number, clabe, titular, is_primary, currency, notes } = data;

    if (!customer_id || !bank_name) {
      return NextResponse.json({ error: "customer_id y banco requeridos" }, { status: 400 });
    }

    // If setting primary, unset others
    if (is_primary) {
      await sql`UPDATE customer_bank_accounts SET is_primary = false WHERE customer_id = ${parseInt(customer_id)}`;
    }

    const [row] = await sql`
      INSERT INTO customer_bank_accounts (customer_id, bank_name, account_number, clabe, titular, is_primary, currency, notes)
      VALUES (${parseInt(customer_id)}, ${bank_name}, ${account_number || null}, ${clabe || null}, ${titular || null}, ${!!is_primary}, ${currency || 'MXN'}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear cuenta" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...update } = data;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM customer_bank_accounts WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (update.is_primary) {
      await sql`UPDATE customer_bank_accounts SET is_primary = false WHERE customer_id = ${current.customer_id}`;
    }

    const [updated] = await sql`
      UPDATE customer_bank_accounts SET
        bank_name = ${update.bank_name !== undefined ? update.bank_name : current.bank_name},
        account_number = ${update.account_number !== undefined ? update.account_number : current.account_number},
        clabe = ${update.clabe !== undefined ? update.clabe : current.clabe},
        titular = ${update.titular !== undefined ? update.titular : current.titular},
        is_primary = ${update.is_primary !== undefined ? !!update.is_primary : current.is_primary},
        verified = ${update.verified !== undefined ? !!update.verified : current.verified},
        verified_by = ${update.verified_by !== undefined ? update.verified_by : current.verified_by},
        verified_at = ${update.verified ? (update.verified_at || new Date()) : current.verified_at},
        currency = ${update.currency !== undefined ? update.currency : current.currency},
        notes = ${update.notes !== undefined ? update.notes : current.notes},
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM customer_bank_accounts WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
