import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const publicToken = searchParams.get("token");

    if (publicToken) {
      const dashboard = await sql`
        SELECT ld.*, dt.*, l.* 
        FROM lot_dashboard_info ld
        LEFT JOIN dashboard_templates dt ON ld.template_id = dt.id
        LEFT JOIN lots l ON ld.lot_id = l.id
        WHERE ld.public_token = ${publicToken} AND ld.is_active = TRUE
      `;
      return NextResponse.json(dashboard[0] || null);
    }

    if (lotId) {
      const dashboard = await sql`
        SELECT ld.*, dt.*, l.* 
        FROM lot_dashboard_info ld
        LEFT JOIN dashboard_templates dt ON ld.template_id = dt.id
        LEFT JOIN lots l ON ld.lot_id = l.id
        WHERE ld.lot_id = ${parseInt(lotId)}
      `;
      return NextResponse.json(dashboard[0] || null);
    }

    return NextResponse.json(
      { error: "lotId o token son requeridos" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json(
      { error: "Error al obtener dashboard" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { lotId, templateId } = await request.json();

    if (!lotId || !templateId) {
      return NextResponse.json(
        { error: "lotId y templateId son requeridos" },
        { status: 400 }
      );
    }

    const publicToken = crypto.randomBytes(16).toString("hex");

    const result = await sql`
      INSERT INTO lot_dashboard_info (lot_id, template_id, public_token, is_active)
      VALUES (${lotId}, ${templateId}, ${publicToken}, TRUE)
      ON CONFLICT (lot_id) 
      DO UPDATE SET template_id = ${templateId}, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating dashboard:", error);
    return NextResponse.json(
      { error: "Error al crear dashboard" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { lotId, templateId, isActive } = await request.json();

    if (!lotId) {
      return NextResponse.json(
        { error: "lotId es requerido" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE lot_dashboard_info
      SET 
        template_id = COALESCE(${templateId}, template_id),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE lot_id = ${lotId}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating dashboard:", error);
    return NextResponse.json(
      { error: "Error al actualizar dashboard" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json(
        { error: "lotId es requerido" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM lot_dashboard_info WHERE lot_id = ${parseInt(lotId)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dashboard:", error);
    return NextResponse.json(
      { error: "Error al eliminar dashboard" },
      { status: 500 }
    );
  }
}
