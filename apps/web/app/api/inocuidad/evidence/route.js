import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  const criteriaId = searchParams.get("criteriaId");
  const inspectionId = searchParams.get("inspectionId");
  try {
    let q = sql`SELECT * FROM inocuidad_evidences WHERE 1=1 `;
    if (lotId) q = sql`${q} AND lot_id = ${parseInt(lotId)}`;
    if (criteriaId) q = sql`${q} AND criteria_id = ${parseInt(criteriaId)}`;
    if (inspectionId) q = sql`${q} AND inspection_id = ${parseInt(inspectionId)}`;
    const rows = await sql`${q} ORDER BY uploaded_at DESC LIMIT 100`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // Evidence linked by ref to criteria/lot/inspection - reuses common upload service (no duplicate doc record)
    const [ev] = await sql`
      INSERT INTO inocuidad_evidences (inspection_id, criteria_id, lot_id, file_url, original_name, file_type, uploaded_by, module_origin)
      VALUES (${body.inspection_id || null}, ${body.criteria_id || null}, ${body.lot_id || null}, ${body.file_url}, ${body.original_name || 'evidencia'}, ${body.file_type || 'image'}, ${body.uploaded_by || 'portal'}, ${body.module_origin || 'inocuidad'})
      RETURNING *
    `;
    return NextResponse.json({ success: true, evidence: ev });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo registrar evidencia" }, { status: 500 });
  }
}
