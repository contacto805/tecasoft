import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const crews = await sql`SELECT * FROM crews WHERE activo = true ORDER BY nombre`;
    return NextResponse.json(crews);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, clave, responsable, telefono, tarifa_default_por_kg } = body;
    const [row] = await sql`
      INSERT INTO crews (nombre, clave, responsable, telefono, tarifa_default_por_kg)
      VALUES (${nombre}, ${clave}, ${responsable}, ${telefono}, ${tarifa_default_por_kg || 1.40})
      RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}