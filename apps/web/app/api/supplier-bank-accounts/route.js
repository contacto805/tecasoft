import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    const supplierType = searchParams.get("supplierType") || "purchase_order";

    let rows;
    if (supplierId) {
      rows = await sql`
        SELECT * FROM supplier_bank_accounts 
        WHERE supplier_id = ${parseInt(supplierId)} AND supplier_type = ${supplierType}
        ORDER BY is_primary DESC, created_at DESC
      `;
    } else {
      rows = await sql`SELECT * FROM supplier_bank_accounts ORDER BY created_at DESC LIMIT 50`;
    }
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener cuentas de proveedor" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { supplier_id, supplier_type = "purchase_order", bank_name, account_number, clabe, titular, is_primary, currency, notes } = data;

    if (!supplier_id || !bank_name) {
      return NextResponse.json({ error: "supplier_id y banco requeridos" }, { status: 400 });
    }

    if (is_primary) {
      await sql`UPDATE supplier_bank_accounts SET is_primary = false WHERE supplier_id = ${parseInt(supplier_id)} AND supplier_type = ${supplier_type}`;
    }

    const [row] = await sql`
      INSERT INTO supplier_bank_accounts (supplier_id, supplier_type, bank_name, account_number, clabe, titular, is_primary, currency, notes)
      VALUES (${parseInt(supplier_id)}, ${supplier_type}, ${bank_name}, ${account_number || null}, ${clabe || null}, ${titular || null}, ${!!is_primary}, ${currency || 'MXN'}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear cuenta de proveedor" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...update } = data;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM supplier_bank_accounts WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (update.is_primary) {
      await sql`UPDATE supplier_bank_accounts SET is_primary = false WHERE supplier_id = ${current.supplier_id} AND supplier_type = ${current.supplier_type}`;
    }

    const [updated] = await sql`
      UPDATE supplier_bank_accounts SET
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
