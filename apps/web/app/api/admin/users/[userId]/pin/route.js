import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Update user PIN
export async function PUT(request, { params }) {
  try {
    const { userId } = await params;
    const { pin } = await request.json();

    // Validate PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "El PIN debe tener exactamente 4 dígitos" },
        { status: 400 }
      );
    }

    // Try update first
    const updated = await sql`
      UPDATE account
      SET password = ${pin}, "updatedAt" = NOW()
      WHERE "userId" = ${userId} AND "providerId" = 'credential'
      RETURNING id
    `;

    if (updated.length === 0) {
      // No existing credential account, create one now (repair for users created without PIN rows)
      const [usr] = await sql`SELECT email FROM "user" WHERE id = ${userId} LIMIT 1`;
      if (usr && usr.email) {
        const aid = crypto.randomUUID();
        await sql`
          INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
          VALUES (${aid}, ${userId}, ${usr.email}, 'credential', ${pin}, NOW(), NOW())
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: "PIN actualizado exitosamente"
    });
  } catch (error) {
    console.error("Error updating PIN:", error);
    return NextResponse.json(
      { error: "Error al actualizar PIN" },
      { status: 500 }
    );
  }
}