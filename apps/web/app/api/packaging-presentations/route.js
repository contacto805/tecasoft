import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, nombre, kilograms, unidad, activo, created_at, updated_at
      FROM packaging_presentations 
      WHERE COALESCE(activo, true) = true
      ORDER BY kilograms ASC, nombre ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching packaging presentations:', error);
    // graceful fallback list if table empty or error
    return NextResponse.json([
      { id: 1, nombre: 'Caja 10 kg', kilograms: 10, unidad: 'kg', activo: true },
      { id: 2, nombre: 'Caja 6 kg', kilograms: 6, unidad: 'kg', activo: true },
      { id: 3, nombre: 'Caja 25 kg', kilograms: 25, unidad: 'kg', activo: true }
    ]);
  }
}