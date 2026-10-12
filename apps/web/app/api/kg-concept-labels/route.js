import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const labels = await sql`SELECT * FROM kg_concept_labels WHERE is_active = true ORDER BY id`;
    const labelMap = {};
    labels.forEach(l => { labelMap[l.concept_key] = l.display_name; });
    return NextResponse.json({ labels, map: labelMap });
  } catch (error) {
    console.error('Error kg labels:', error);
    return NextResponse.json({ labels: [], map: {proceso: 'Proceso', desecho: 'Desecho', procesados: 'Procesados', produccion: 'Producción'} });
  }
}

export async function PUT(request) {
  try {
    const { concept_key, display_name } = await request.json();
    if (!concept_key || !display_name) return NextResponse.json({ error: 'Falta clave y nombre' }, { status: 400 });
    const [updated] = await sql`
      UPDATE kg_concept_labels 
      SET display_name = ${display_name}, updated_at = NOW() 
      WHERE concept_key = ${concept_key} 
      RETURNING *
    `;
    return NextResponse.json(updated || {});
  } catch (error) {
    console.error('Error updating kg label:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
