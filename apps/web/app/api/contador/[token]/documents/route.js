import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    // Verificar que el token existe
    const [tokenData] = await sql`
      SELECT lat.lot_id, l.producer, l.producer as producer_name, l.date as cutting_date
      FROM lot_accountant_tokens lat
      JOIN lots l ON lat.lot_id = l.id
      WHERE lat.token = ${token}
    `;

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Enlace inválido' },
        { status: 404 }
      );
    }

    // Obtener documentos del lote
    const documents = await sql`
      SELECT 
        id,
        lot_id,
        document_type,
        file_name,
        file_url,
        google_drive_file_id,
        google_drive_folder_id,
        uploaded_at,
        uploaded_by
      FROM lot_accountant_documents
      WHERE lot_id = ${tokenData.lot_id}
      ORDER BY uploaded_at DESC
    `;

    return NextResponse.json({
      success: true,
      lotId: tokenData.lot_id,
      producerName: tokenData.producer_name,
      cuttingDate: tokenData.cutting_date,
      documents: documents || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Error al obtener documentos' },
      { status: 500 }
    );
  }
}

// Eliminar documento de Google Drive
export async function DELETE(request, { params }) {
  try {
    const { token } = await params;
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'ID de documento requerido' },
        { status: 400 }
      );
    }

    // Verificar que el token existe
    const [tokenData] = await sql`
      SELECT lat.lot_id
      FROM lot_accountant_tokens lat
      WHERE lat.token = ${token}
    `;

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Enlace inválido' },
        { status: 404 }
      );
    }

    // Obtener información del documento
    const [document] = await sql`
      SELECT google_drive_file_id
      FROM lot_accountant_documents
      WHERE id = ${parseInt(documentId)} AND lot_id = ${tokenData.lot_id}
    `;

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    // Obtener access token de Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Error al obtener access token de Google');
    }

    const { access_token } = await tokenResponse.json();

    // Eliminar archivo de Google Drive
    const deleteResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${document.google_drive_file_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      throw new Error('Error al eliminar archivo de Google Drive');
    }

    // Eliminar de la base de datos
    await sql`
      DELETE FROM lot_accountant_documents
      WHERE id = ${parseInt(documentId)}
    `;

    return NextResponse.json({
      success: true,
      message: 'Documento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar documento' },
      { status: 500 }
    );
  }
}
