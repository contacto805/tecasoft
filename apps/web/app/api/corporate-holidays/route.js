import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const activeOnly = searchParams.get("active") !== "false";

    const all = await sql`SELECT * FROM corporate_holidays ORDER BY holiday_date ASC`;
    let holidays = all;
    if (year) {
      const y = parseInt(year);
      holidays = holidays.filter(h => h.year === y);
    }
    if (activeOnly) {
      holidays = holidays.filter(h => h.is_active);
    }
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
        year = ${updates.year ? parseInt(updates.year) : null}::int,
        holiday_date = ${updates.holiday_date || null}::date,
        description = ${updates.description || null},
        applicability = ${updates.applicability || null},
        validity = ${updates.validity || null},
        zone = ${updates.zone || null},
        is_active = ${updates.is_active !== undefined ? updates.is_active : null},
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
