import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_BASE_DIR = '/home/user/apps/web/public/storage/documentos-pago';

// Asegurar que las carpetas existen
async function ensureDirectories() {
  const directories = [
    UPLOAD_BASE_DIR,
    `${UPLOAD_BASE_DIR}/proveedores`,
    `${UPLOAD_BASE_DIR}/clientes`,
    `${UPLOAD_BASE_DIR}/facturas`,
    `${UPLOAD_BASE_DIR}/comprobantes`,
    `${UPLOAD_BASE_DIR}/evidencias`,
    `${UPLOAD_BASE_DIR}/xml`,
    `${UPLOAD_BASE_DIR}/pdf`,
    `${UPLOAD_BASE_DIR}/imagenes`
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }
}

// Calcular hash del archivo
function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function POST(request, { params }) {
  try {
    await ensureDirectories();

    const { token } = await params;
    const formData = await request.formData();
    
    const documentType = formData.get('documentType');
    const file = formData.get('file');

    if (!file || !documentType) {
      return NextResponse.json(
        { error: 'Archivo y tipo de documento son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el token existe
    const [tokenData] = await sql`
      SELECT lat.lot_id, l.producer, l.producer as producer_name, l.date as cutting_date, l.producer AS producer_id
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

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileHash = calculateFileHash(buffer);

    // Generar nombre de archivo
    const extension = path.extname(file.name);
    const dateStr = new Date().toISOString().split('T')[0];
    const producerName = tokenData.producer_name.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const systemFileName = `LOT-${tokenData.lot_id}_${dateStr}_${producerName}_${documentType}_${timestamp}${extension}`;

    // Determinar subcarpeta
    let subfolder = 'comprobantes';
    if (documentType.toLowerCase().includes('factura')) subfolder = 'facturas';
    else if (documentType.toLowerCase().includes('comprobante')) subfolder = 'comprobantes';
    else if (extension === '.xml') subfolder = 'xml';
    else if (extension === '.pdf') subfolder = 'pdf';

    const relativePath = `storage/documentos-pago/${subfolder}/${systemFileName}`;
    const fullPath = path.join(UPLOAD_BASE_DIR, subfolder, systemFileName);

    // Guardar archivo
    await fs.writeFile(fullPath, buffer);

    // Guardar en la tabla anterior para compatibilidad
    const [legacyDocument] = await sql`
      INSERT INTO lot_accountant_documents (
        lot_id,
        document_type,
        file_name,
        file_url,
        google_drive_file_id,
        google_drive_folder_id
      ) VALUES (
        ${tokenData.lot_id},
        ${documentType},
        ${file.name},
        ${'/' + relativePath},
        NULL,
        NULL
      )
      RETURNING *
    `;

    // Guardar en la nueva tabla
    const [document] = await sql`
      INSERT INTO payment_documents (
        payment_id,
        provider_id,
        document_type,
        original_file_name,
        system_file_name,
        internal_file_path,
        file_extension,
        file_size_bytes,
        file_hash,
        uploaded_by,
        status,
        module_origin,
        secure_internal_url
      ) VALUES (
        NULL,
        ${tokenData.producer_id || null},
        ${documentType},
        ${file.name},
        ${systemFileName},
        ${relativePath},
        ${extension},
        ${buffer.length},
        ${fileHash},
        'contador_token',
        'pending',
        'contador_upload',
        ${'/' + relativePath}
      )
      RETURNING *
    `;

    // Registrar en auditoría
    await sql`
      INSERT INTO payment_document_audit (
        document_id,
        user_id,
        user_name,
        action,
        document_name,
        module_related
      ) VALUES (
        ${document.id},
        'contador_token',
        'Contador (Token)',
        'uploaded',
        ${file.name},
        'contador_upload'
      )
    `;

    return NextResponse.json({ 
      success: true,
      document,
      message: 'Documento subido exitosamente al almacenamiento interno'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: error.message || 'Error al subir documento' },
      { status: 500 }
    );
  }
}
