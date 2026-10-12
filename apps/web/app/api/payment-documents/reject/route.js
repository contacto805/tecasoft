import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { documentId, userId, userName, reason } = body;

    if (!documentId || !userId || !reason) {
      return NextResponse.json(
        { error: 'Documento ID, Usuario y Razón son requeridos' },
        { status: 400 }
      );
    }

    // Obtener documento
    const [document] = await sql`
      SELECT * FROM payment_documents
      WHERE id = ${documentId}
      AND is_active = true
    `;

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar estatus
    const [updated] = await sql`
      UPDATE payment_documents
      SET 
        status = 'rejected',
        observations = ${reason},
        updated_at = NOW()
      WHERE id = ${documentId}
      RETURNING *
    `;

    // Registrar en auditoría
    await sql`
      INSERT INTO payment_document_audit (
        document_id,
        user_id,
        user_name,
        action,
        document_name
      ) VALUES (
        ${documentId},
        ${userId},
        ${userName || 'Usuario'},
        'rejected',
        ${document.original_file_name}
      )
    `;

    return NextResponse.json({
      success: true,
      document: updated,
      message: 'Documento rechazado exitosamente'
    });

  } catch (error) {
    console.error('Error rejecting document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
