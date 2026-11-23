import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { producerDocumentPath } from "@/app/api/utils/producer-document-storage";
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');

    if (!documentId) {
      return NextResponse.json(
        { error: 'ID de documento requerido' },
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

    // Construir ruta completa
    const privateProducerFile = document.module_origin === "portal-productor" &&
      document.internal_file_path === "producer-private/" + document.system_file_name;
    const erpUser = privateProducerFile ? await getVerifiedErpUser() : null;
    if (privateProducerFile && !erpUser) {
      return NextResponse.json({ error: "Inicia sesión en Tecavo Soft" }, { status: 401 });
    }
    if (erpUser && !erpUser.is_super_admin && !/admin/i.test(erpUser.admin_role || "")) {
      return NextResponse.json({ error: "Se requiere acceso administrativo" }, { status: 403 });
    }
    const fullPath = privateProducerFile ? producerDocumentPath(document.system_file_name) :
      path.join('/home/user/apps/web/public', document.internal_file_path);

    // Verificar que el archivo existe
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json(
        { error: 'Archivo no encontrado en el servidor' },
        { status: 404 }
      );
    }

    // Leer archivo
    const fileBuffer = await fs.readFile(fullPath);

    // Registrar descarga en auditoría
    await sql`
      INSERT INTO payment_document_audit (
        document_id,
        user_id,
        user_name,
        action,
        document_name
      ) VALUES (
        ${documentId},
        ${erpUser?.id || userId || 'system'},
        ${erpUser ? 'Administración' : userName || 'Sistema'},
        'downloaded',
        ${document.original_file_name}
      )
    `;

    // Determinar content type
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const contentType = contentTypes[document.file_extension.toLowerCase()] || 'application/octet-stream';

    // Retornar archivo
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.original_file_name}"`,
        'Content-Length': document.file_size_bytes.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
