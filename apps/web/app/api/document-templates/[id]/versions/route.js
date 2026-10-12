import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: obtener historial de versiones de una plantilla
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const versions = await sql`
      SELECT * FROM document_template_versions 
      WHERE template_id = ${parseInt(id)} 
      ORDER BY version_number DESC
    `;

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching template versions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
