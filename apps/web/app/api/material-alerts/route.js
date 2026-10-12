import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("materialId");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const alerts = await sql`
      SELECT 
        ma.id, 
        ma.material_id, 
        mi.material_name,
        mi.quantity_available,
        ma.alert_type, 
        ma.alert_threshold, 
        ma.alert_message, 
        ma.is_active,
        ma.created_at, 
        ma.updated_at,
        CASE 
          WHEN ma.alert_type = 'LOW_STOCK' AND mi.quantity_available <= ma.alert_threshold THEN 'triggered'
          ELSE 'normal'
        END as alert_status
      FROM material_alerts ma
      JOIN materials_inventory mi ON ma.material_id = mi.id
      WHERE 1=1
        ${materialId ? sql`AND ma.material_id = ${parseInt(materialId)}` : sql``}
        ${activeOnly ? sql`AND ma.is_active = true` : sql``}
      ORDER BY ma.material_id ASC
    `;
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error?.message || String(error));
    return NextResponse.json(
      { error: "Error al obtener alertas" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      material_id,
      alert_type,
      alert_threshold,
      alert_message,
    } = await request.json();

    if (!material_id || !alert_type || alert_threshold === undefined) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    // Check if material exists
    const materialCheck = await sql`
      SELECT id FROM materials_inventory WHERE id = ${parseInt(material_id)}
    `;

    if (materialCheck.length === 0) {
      return NextResponse.json(
        { error: "Material no encontrado" },
        { status: 404 }
      );
    }

    // Check if alert already exists
    const existingAlert = await sql`
      SELECT id FROM material_alerts 
      WHERE material_id = ${parseInt(material_id)} AND alert_type = ${alert_type}
    `;

    if (existingAlert.length > 0) {
      return NextResponse.json(
        { error: "Esta alerta ya existe para este material" },
        { status: 409 }
      );
    }

    const result = await sql`
      INSERT INTO material_alerts 
      (material_id, alert_type, alert_threshold, alert_message, is_active)
      VALUES 
      (${parseInt(material_id)}, ${alert_type}, ${parseFloat(alert_threshold)}, ${alert_message || null}, true)
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: "Error al crear alerta" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      alert_threshold,
      alert_message,
      is_active,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID de alerta requerido" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE material_alerts
      SET 
        alert_threshold = COALESCE(${alert_threshold !== undefined ? parseFloat(alert_threshold) : null}, alert_threshold),
        alert_message = COALESCE(${alert_message || null}, alert_message),
        is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Alerta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: "Error al actualizar alerta" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de alerta requerido" },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM material_alerts
      WHERE id = ${parseInt(id)}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Alerta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Alerta eliminada" });
  } catch (error) {
    console.error("Error deleting alert:", error);
    return NextResponse.json(
      { error: "Error al eliminar alerta" },
      { status: 500 }
    );
  }
}
