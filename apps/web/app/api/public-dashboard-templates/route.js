import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const templates = await sql`
      SELECT * FROM public_dashboard_templates_library 
      WHERE is_active = true 
      ORDER BY id
    `;
    
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
