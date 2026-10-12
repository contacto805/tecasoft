import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  try {
    const { lotId } = await params;
    const id = parseInt(lotId);
    if (!id) return NextResponse.json({ error: "Lote requerido" }, { status: 400 });

    const body = await request.json();
    const { document_type, file_name, file_url } = body || {};

    if (!document_type || !file_name) {
      return NextResponse.json({ error: "Tipo de documento y nombre requeridos" }, { status: 400 });
    }

    // Insert into lot_accountant_documents (used also by contador)
    const [record] = await sql`
      INSERT INTO lot_accountant_documents (
        lot_id,
        document_type,
        file_name,
        file_url,
        uploaded_at,
        uploaded_by
      ) VALUES (
        ${id},
        ${document_type},
        ${file_name},
        ${file_url || null},
        NOW(),
        'expedientes_admin'
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, document: record });
  } catch (e) {
    console.error("documents POST error:", e);
    return NextResponse.json({ error: "No se pudo registrar documento" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  // helper list specifically for a lot
  try {
    const { lotId } = await params;
    const id = parseInt(lotId);
    if (!id) return NextResponse.json([]);

    const docs = await sql`
      SELECT * FROM lot_accountant_documents
      WHERE lot_id = ${id}
      ORDER BY uploaded_at DESC
    `;
    return NextResponse.json(docs);
  } catch (_) {
    return NextResponse.json([]);
  }
}