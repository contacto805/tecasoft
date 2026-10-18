import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { createFinancialAdjustment, authorizeAdjustment } from "@/app/api/utils/financial-engine";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const entityId = searchParams.get("entity_id");
    const status = searchParams.get("status");

    let q = sql`SELECT * FROM financial_adjustments ORDER BY created_at DESC LIMIT 100`;
    if (entityType && entityId) {
      q = sql`SELECT * FROM financial_adjustments WHERE entity_type = ${entityType} AND entity_id = ${parseInt(entityId)} ORDER BY created_at DESC`;
    } else if (status) {
      q = sql`SELECT * FROM financial_adjustments WHERE status = ${status} ORDER BY created_at DESC LIMIT 50`;
    }

    const rows = await q;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // user info should come from session in real flow; here we take from payload or default
    const user = { name: body.requested_by || "usuario", is_super_admin: body.is_super || false, admin_role: body.admin_role || "" };

    const result = await createFinancialAdjustment(body, user);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, action, user = {} } = body;

    if (action === "authorize") {
      const res = await authorizeAdjustment(id, user);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
