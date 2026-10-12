import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { userId } = await params;

    // Get user's current module permissions
    const permissions = await sql`
      SELECT 
        module_name,
        can_view,
        can_create,
        can_edit,
        can_delete
      FROM user_permissions 
      WHERE user_id = ${userId}
      ORDER BY module_name
    `;

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching user modules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { userId } = await params;
    const { modules } = await request.json();

    if (!modules || !Array.isArray(modules)) {
      return NextResponse.json(
        { error: 'modules array is required' },
        { status: 400 }
      );
    }

    // Delete all existing permissions for this user
    await sql`DELETE FROM user_permissions WHERE user_id = ${userId}`;

    // Insert new permissions
    const results = [];
    for (const module of modules) {
      const result = await sql`
        INSERT INTO user_permissions (
          user_id,
          module_name,
          can_view,
          can_create,
          can_edit,
          can_delete
        )
        VALUES (
          ${userId},
          ${module.module_name},
          ${module.can_view !== undefined ? module.can_view : true},
          ${module.can_create !== undefined ? module.can_create : false},
          ${module.can_edit !== undefined ? module.can_edit : false},
          ${module.can_delete !== undefined ? module.can_delete : false}
        )
        RETURNING *
      `;
      results.push(result[0]);
    }

    return NextResponse.json({
      success: true,
      permissions: results
    });
  } catch (error) {
    console.error('Error updating user modules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
