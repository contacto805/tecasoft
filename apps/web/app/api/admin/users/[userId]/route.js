import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Delete user
export async function DELETE(request, { params }) {
  try {
    const { userId } = await params;

    // Delete user permissions
    await sql`
      DELETE FROM user_permissions WHERE user_id = ${userId}
    `;

    // Delete account
    await sql`
      DELETE FROM account WHERE "userId" = ${userId}
    `;

    // Delete user
    await sql`
      DELETE FROM "user" WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado exitosamente"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}
