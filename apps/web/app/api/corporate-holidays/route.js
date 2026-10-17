import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const activeOnly = searchParams.get("active") !== "false";

    let where = sql``;
    if (year && activeOnly) {
      where = sql`WHERE year = ${parseInt(year)} AND is_active = true`;
    } else if (year) {
      where = sql`WHERE year = ${parseInt(year)}`;
    } else if (activeOnly) {
      where = sql`WHERE is_active = true`;
    }

    const holidays = await sql`
      SELECT * FROM corporate_holidays 
      ${where}
      ORDER BY holiday_date ASC
    `;
    return NextResponse.json(holidays);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { year, holiday_date, description, applicability, validity, zone, created_by } = data;

    if (!year || !holiday_date) {
      return NextResponse.json({ error: "year y holiday_date requeridos" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO corporate_holidays (year, holiday_date, description, applicability, validity, zone, created_by)
      VALUES (${parseInt(year)}, ${holiday_date}, ${description || null}, ${applicability || 'pagos_productores'}, ${validity || 'vigente'}, ${zone || 'America/Mexico_City'}, ${created_by || 'system'})
      RETURNING *
    `;
    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating holiday:", error);
    return NextResponse.json({ error: "Error al crear festivo" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...updates } = data;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [updated] = await sql`
      UPDATE corporate_holidays SET
        year = COALESCE(${updates.year ? parseInt(updates.year) : null}, year),
        holiday_date = COALESCE(${updates.holiday_date || null}, holiday_date),
        description = COALESCE(${updates.description || null}, description),
        applicability = COALESCE(${updates.applicability || null}, applicability),
        validity = COALESCE(${updates.validity || null}, validity),
        zone = COALESCE(${updates.zone || null}, zone),
        is_active = COALESCE(${updates.is_active !== undefined ? updates.is_active : null}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM corporate_holidays WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
