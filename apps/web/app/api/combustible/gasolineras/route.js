import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM combustible_gasolineras WHERE activo = true ORDER BY nombre ASC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const { nombre, direccion } = await request.json();
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const [g] = await sql`
      INSERT INTO combustible_gasolineras (nombre, direccion) VALUES (${nombre}, ${direccion || null}) RETURNING *
    `;
    return NextResponse.json(g, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
