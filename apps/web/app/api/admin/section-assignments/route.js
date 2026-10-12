import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get("module") || "gastos";
    const userId = searchParams.get("userId");

    let where = sql`WHERE is_active = true`;
    if (moduleName) {
      where = sql`${where} AND module_name = ${moduleName}`;
    }
    if (userId) {
      where = sql`${where} AND user_id = ${userId}`;
    }

    const assignments = await sql`
      SELECT * FROM module_section_assignments 
      ${where} 
      ORDER BY section_name ASC, user_name ASC
    `;
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching section assignments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, userName, moduleName, sectionName, role, assignedBy } = await request.json();

    if (!userId || !moduleName || !sectionName || !role) {
      return NextResponse.json({ error: "userId, moduleName, sectionName and role are required" }, { status: 400 });
    }

    const [result] = await sql`
      INSERT INTO module_section_assignments (user_id, user_name, module_name, section_name, role, assigned_by)
      VALUES (${userId}, ${userName || ""}, ${moduleName}, ${sectionName}, ${role}, ${assignedBy || "admin"})
      RETURNING *
    `;
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, role, isActive } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const fields = [];
    if (role !== undefined) fields.push(sql`role = ${role}`);
    if (isActive !== undefined) fields.push(sql`is_active = ${isActive}`);

    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const [result] = await sql`
      UPDATE module_section_assignments 
      SET ${fields[0]}, assigned_at = NOW() 
      WHERE id = ${id} 
      RETURNING *
    `;
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await sql`DELETE FROM module_section_assignments WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
