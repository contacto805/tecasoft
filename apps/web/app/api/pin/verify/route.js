import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { userId, pin, requiredRole } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ error: "userId y PIN requeridos" }, { status: 400 });
    }

    const [userPin] = await sql`
      SELECT * FROM user_pins 
      WHERE user_id = ${userId} AND activo = true 
      LIMIT 1
    `;

    if (!userPin) {
      return NextResponse.json({ error: "No hay PIN configurado para este usuario", authorized: false }, { status: 401 });
    }

    const isValid = await bcrypt.compare(String(pin), userPin.pin_hash);

    if (!isValid) {
      await sql`
        INSERT INTO pin_audit_log (user_id, pin_used, module, entity_type, motivo_ajuste, timestamp)
        VALUES (${userId}, '***', 'seguridad', 'pin_verify', 'Intento fallido de PIN', CURRENT_TIMESTAMP)
      `;
      return NextResponse.json({ error: "PIN incorrecto", authorized: false }, { status: 401 });
    }

    // Role check if required
    if (requiredRole && userPin.role !== requiredRole && !['SUPERVISOR_CALIDAD', 'GERENTE', 'SUPERADMIN'].includes(userPin.role)) {
      return NextResponse.json({ error: "Rol insuficiente para esta acción", authorized: false }, { status: 403 });
    }

    // Success log
    await sql`
      INSERT INTO pin_audit_log (user_id, pin_used, module, entity_type, motivo_ajuste, timestamp)
      VALUES (${userId}, '***', 'seguridad', 'pin_verify', 'PIN autorizado correctamente', CURRENT_TIMESTAMP)
    `;

    return NextResponse.json({ 
      authorized: true, 
      role: userPin.role,
      nombre: userPin.nombre_usuario || userId 
    });
  } catch (error) {
    console.error("PIN verify error:", error);
    return NextResponse.json({ error: error.message, authorized: false }, { status: 500 });
  }
}
