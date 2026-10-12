import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// Obtener access token de Google Drive
async function getGoogleAccessToken() {
  try {
    const driveConfig = await sql`
      SELECT value FROM system_settings WHERE key = 'google_drive_config'
    `;

    if (!driveConfig || driveConfig.length === 0) {
      throw new Error('Google Drive no está configurado');
    }

    const config = JSON.parse(driveConfig[0].value);
    const { clientId, clientSecret, refreshToken } = config;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Error al obtener access token de Google');
    }

    const { access_token } = await tokenResponse.json();
    return access_token;
  } catch (error) {
    console.error('Error getting Google access token:', error);
    throw error;
  }
}

// Descargar archivo de Google Drive
async function downloadFromDrive(accessToken, fileId) {
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!downloadResponse.ok) {
    throw new Error(`Error al descargar archivo de Google Drive: ${downloadResponse.statusText}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Calcular hash del archivo
function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function POST(request) {
  try {
    await ensureDirectories();

    const body = await request.json();
    const { userId, userName } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuario requerido' },
        { status: 400 }
      );
    }

    // Obtener access token de Google Drive
    let accessToken;
    try {
      accessToken = await getGoogleAccessToken();
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar con Google Drive. Puede que no esté configurado.',
        migratedCount: 0
      });
    }

    // Obtener todos los documentos de lotes que tienen google_drive_file_id
    const gdriveDocuments = await sql`
      SELECT * FROM lot_accountant_documents
      WHERE google_drive_file_id IS NOT NULL
      ORDER BY id
    `;

    if (!gdriveDocuments || gdriveDocuments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay documentos de Google Drive para migrar',
        migratedCount: 0
      });
    }

    let migratedCount = 0;
    let errors = [];

    for (const doc of gdriveDocuments) {
      try {
        // Descargar archivo de Google Drive
        const fileBuffer = await downloadFromDrive(accessToken, doc.google_drive_file_id);
        const fileHash = calculateFileHash(fileBuffer);

        // Generar nombre de archivo
        const extension = path.extname(doc.file_name) || '.pdf';
        const timestamp = Date.now();
        const systemFileName = `MIGRADO-LOT${doc.lot_id}_${doc.document_type}_${timestamp}${extension}`;

        // Determinar subcarpeta
        let subfolder = 'comprobantes';
        if (doc.document_type.toLowerCase().includes('factura')) subfolder = 'facturas';
        else if (doc.document_type.toLowerCase().includes('comprobante')) subfolder = 'comprobantes';
        else if (extension === '.xml') subfolder = 'xml';
        else if (extension === '.pdf') subfolder = 'pdf';

        const relativePath = `storage/documentos-pago/${subfolder}/${systemFileName}`;
        const fullPath = path.join(UPLOAD_BASE_DIR, subfolder, systemFileName);

        // Guardar archivo
        await fs.writeFile(fullPath, fileBuffer);

        // Registrar en payment_documents
        const [newDocument] = await sql`
          INSERT INTO payment_documents (
            payment_id,
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
            secure_internal_url,
            migrated_from_gdrive,
            google_drive_file_id
          ) VALUES (
            NULL,
            ${doc.document_type},
            ${doc.file_name},
            ${systemFileName},
            ${relativePath},
            ${extension},
            ${fileBuffer.length},
            ${fileHash},
            ${userId},
            'migrated',
            'google_drive_migration',
            ${'/' + relativePath},
            true,
            ${doc.google_drive_file_id}
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
            ${newDocument.id},
            ${userId},
            ${userName || 'Sistema'},
            'migrated_from_gdrive',
            ${doc.file_name},
            'migration'
          )
        `;

        migratedCount++;

      } catch (error) {
        console.error(`Error migrating document ${doc.id}:`, error);
        errors.push({
          documentId: doc.id,
          fileName: doc.file_name,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migración completada. ${migratedCount} documentos migrados.`,
      migratedCount,
      totalDocuments: gdriveDocuments.length,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Error migrating documents from Google Drive:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    // Obtener estado de migración
    const gdriveDocuments = await sql`
      SELECT COUNT(*) as total FROM lot_accountant_documents
      WHERE google_drive_file_id IS NOT NULL
    `;

    const migratedDocuments = await sql`
      SELECT COUNT(*) as total FROM payment_documents
      WHERE migrated_from_gdrive = true
    `;

    return NextResponse.json({
      totalGDriveDocuments: parseInt(gdriveDocuments[0]?.total || 0),
      migratedDocuments: parseInt(migratedDocuments[0]?.total || 0),
      pendingMigration: parseInt(gdriveDocuments[0]?.total || 0) - parseInt(migratedDocuments[0]?.total || 0)
    });

  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
