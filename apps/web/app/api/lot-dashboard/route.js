import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { ensureLotLink, getPublicLot, getLotPresentation } from "@/app/api/utils/lot-portal";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    const publicToken = searchParams.get("token");

    if (publicToken !== null) {
      const lot = await getPublicLot(publicToken);
      if (!lot) return NextResponse.json({ error: "Lote no disponible" }, { status: 404 });
      const { lot: presentation } = await getLotPresentation(lot);
      const { lot_id, ...visibleLot } = presentation;
      return NextResponse.json(visibleLot, { headers: { "Cache-Control": "no-store" } });
    }
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });

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

    const dashboards = await sql`
      SELECT l.id, l.id AS lot_id, COALESCE(p.public_token, d.public_token) AS public_token,
             d.template_id, dt.template_name
      FROM lots l
      LEFT JOIN lot_dashboard_info d ON d.lot_id = l.id
      LEFT JOIN dashboard_templates dt ON dt.id = d.template_id
      LEFT JOIN LATERAL (
        SELECT public_token FROM public_lot_links WHERE lot_id = l.id AND is_active = true
        ORDER BY id LIMIT 1
      ) p ON true
      WHERE d.is_active IS DISTINCT FROM false AND COALESCE(p.public_token, d.public_token) IS NOT NULL
      ORDER BY l.id DESC
    `;
    return NextResponse.json(dashboards);
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
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    const { lotId, templateId } = await request.json();

    if (!lotId || !templateId) {
      return NextResponse.json(
        { error: "lotId y templateId son requeridos" },
        { status: 400 }
      );
    }

    const link = await ensureLotLink(lotId);
    if (!link) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    const result = await sql`
      UPDATE lot_dashboard_info SET template_id = ${templateId}, is_active = true,
             updated_at = CURRENT_TIMESTAMP
      WHERE lot_id = ${lotId}
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
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
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
    if (!await getVerifiedErpUser()) return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json(
        { error: "lotId es requerido" },
        { status: 400 }
      );
    }

    const link = await ensureLotLink(lotId);
    if (!link) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    await sql`UPDATE lot_dashboard_info SET is_active = false, updated_at = NOW() WHERE lot_id = ${lotId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dashboard:", error);
    return NextResponse.json(
      { error: "Error al eliminar dashboard" },
      { status: 500 }
    );
  }
}
