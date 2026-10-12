import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get permissions for specific user
      const permissions = await sql`
        SELECT * FROM user_permissions 
        WHERE user_id = ${userId}
        ORDER BY module_name
      `;
      return NextResponse.json(permissions);
    }

    // Get all users with their permissions
    const users = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u."emailVerified",
        u."createdAt",
        u.is_super_admin,
        u.admin_role,
        COALESCE(json_agg(
          json_build_object(
            'id', up.id,
            'module_name', up.module_name,
            'can_view', up.can_view,
            'can_create', up.can_create,
            'can_edit', up.can_edit,
            'can_delete', up.can_delete
          ) ORDER BY up.module_name
        ) FILTER (WHERE up.module_name IS NOT NULL), '[]'::json) as permissions
      FROM "user" u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      GROUP BY u.id, u.name, u.email, u."emailVerified", u."createdAt", u.is_super_admin, u.admin_role
      ORDER BY u.name
    `;
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, permissions } = await request.json();

    if (!userId || !permissions) {
      return NextResponse.json(
        { error: 'userId and permissions are required' },
        { status: 400 }
      );
    }

    // Delete existing permissions for this user
    await sql`DELETE FROM user_permissions WHERE user_id = ${userId}`;

    // Insert new permissions
    const results = [];
    for (const perm of permissions) {
      const result = await sql`
        INSERT INTO user_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
        VALUES (${userId}, ${perm.module_name}, ${perm.can_view}, ${perm.can_create}, ${perm.can_edit}, ${perm.can_delete})
        RETURNING *
      `;
      results.push(result[0]);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error setting permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, userId, moduleData } = await request.json();

    if (!id || !moduleData) {
      return NextResponse.json(
        { error: 'id and moduleData are required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE user_permissions 
      SET 
        can_view = ${moduleData.can_view},
        can_create = ${moduleData.can_create},
        can_edit = ${moduleData.can_edit},
        can_delete = ${moduleData.can_delete},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Permission record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (id) {
      // Delete specific permission
      const result = await sql`DELETE FROM user_permissions WHERE id = ${id} RETURNING *`;
      return NextResponse.json(result[0] || { message: 'Permission deleted' });
    } else if (userId) {
      // Delete all permissions for user
      await sql`DELETE FROM user_permissions WHERE user_id = ${userId}`;
      return NextResponse.json({ message: 'All permissions deleted for user' });
    }

    return NextResponse.json(
      { error: 'id or userId parameter required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting permission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
