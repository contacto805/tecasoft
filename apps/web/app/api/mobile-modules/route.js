import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const modules = await sql`
      SELECT id, module_name, module_route, module_icon, mobile_qr_code
      FROM menu_modules
      WHERE has_mobile_app = true
      ORDER BY module_order ASC
    `;
    
    return NextResponse.json(modules);
  } catch (error) {
    console.error('Error fetching mobile modules:', error);
    return NextResponse.json({ error: 'Error al obtener módulos móviles' }, { status: 500 });
  }
}
