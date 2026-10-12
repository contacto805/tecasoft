import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

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

// Generar nombre único de archivo
function generateFileName(paymentId, date, providerName, documentType, extension) {
  const sanitizedProvider = providerName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedType = documentType.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  return `PAGO-${paymentId}_${date}_${sanitizedProvider}_${sanitizedType}_${timestamp}${extension}`;
}

// Determinar subcarpeta según tipo de documento
function getSubfolder(documentType, extension) {
  if (documentType.toLowerCase().includes('factura')) return 'facturas';
  if (documentType.toLowerCase().includes('comprobante')) return 'comprobantes';
  if (documentType.toLowerCase().includes('evidencia')) return 'evidencias';
  if (extension === '.xml') return 'xml';
  if (extension === '.pdf') return 'pdf';
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(extension.toLowerCase())) return 'imagenes';
  return 'comprobantes';
}

export async function POST(request) {
  try {
    await ensureDirectories();

    const formData = await request.formData();
    const file = formData.get('file');
    const paymentId = formData.get('paymentId');
    const providerId = formData.get('providerId');
    const customerId = formData.get('customerId');
    const documentType = formData.get('documentType');
    const moduleOrigin = formData.get('moduleOrigin');
    const userId = formData.get('userId');
    const userName = formData.get('userName');
    const observations = formData.get('observations');

    if (!file || !paymentId || !documentType || !userId) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileHash = calculateFileHash(buffer);

    // Validar duplicados
    const existingDocs = await sql`
      SELECT * FROM payment_documents
      WHERE file_hash = ${fileHash}
      AND is_active = true
    `;

    if (existingDocs && existingDocs.length > 0) {
      // Obtener información del documento duplicado
      const duplicate = existingDocs[0];
      const [payment] = await sql`
        SELECT folio, producer_name, amount
        FROM payment_schedule
        WHERE id = ${duplicate.payment_id}
      `;

      return NextResponse.json({
        warning: 'duplicate',
        message: 'Este archivo parece estar duplicado',
        duplicateInfo: {
          documentId: duplicate.id,
          paymentFolio: payment?.folio,
          producerName: payment?.producer_name,
          amount: payment?.amount,
          uploadDate: duplicate.upload_date,
          uploadedBy: duplicate.uploaded_by
        }
      }, { status: 409 });
    }

    // Obtener información del pago
    const [payment] = await sql`
      SELECT folio, producer_name, beneficiary_name, fruit_reception_date
      FROM payment_schedule
      WHERE id = ${paymentId}
    `;

    if (!payment) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      );
    }

    // Generar nombre de archivo
    const extension = path.extname(file.name);
    const dateStr = new Date().toISOString().split('T')[0];
    const providerName = payment.beneficiary_name || payment.producer_name || 'Sin_Nombre';
    const systemFileName = generateFileName(paymentId, dateStr, providerName, documentType, extension);

    // Determinar subcarpeta
    const subfolder = getSubfolder(documentType, extension);
    const relativePath = `storage/documentos-pago/${subfolder}/${systemFileName}`;
    const fullPath = path.join(UPLOAD_BASE_DIR, subfolder, systemFileName);

    // Guardar archivo
    await fs.writeFile(fullPath, buffer);

    // Registrar en base de datos
    const [document] = await sql`
      INSERT INTO payment_documents (
        payment_id,
        provider_id,
        customer_id,
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
        observations,
        secure_internal_url
      ) VALUES (
        ${paymentId},
        ${providerId || null},
        ${customerId || null},
        ${documentType},
        ${file.name},
        ${systemFileName},
        ${relativePath},
        ${extension},
        ${buffer.length},
        ${fileHash},
        ${userId},
        'pending',
        ${moduleOrigin || 'payment_schedule'},
        ${observations || null},
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
        ${userId},
        ${userName || 'Usuario'},
        'uploaded',
        ${file.name},
        ${moduleOrigin || 'payment_schedule'}
      )
    `;

    return NextResponse.json({
      success: true,
      document,
      message: 'Documento subido exitosamente'
    });

  } catch (error) {
    console.error('Error uploading payment document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const providerId = searchParams.get('providerId');
    const customerId = searchParams.get('customerId');
    const documentType = searchParams.get('documentType');

    let documents;

    if (paymentId) {
      documents = await sql`
        SELECT * FROM payment_documents
        WHERE payment_id = ${paymentId}
        AND is_active = true
        ORDER BY upload_date DESC
      `;
    } else if (providerId) {
      documents = await sql`
        SELECT * FROM payment_documents
        WHERE provider_id = ${providerId}
        AND is_active = true
        ORDER BY upload_date DESC
      `;
    } else if (customerId) {
      documents = await sql`
        SELECT * FROM payment_documents
        WHERE customer_id = ${customerId}
        AND is_active = true
        ORDER BY upload_date DESC
      `;
    } else if (documentType) {
      documents = await sql`
        SELECT * FROM payment_documents
        WHERE document_type = ${documentType}
        AND is_active = true
        ORDER BY upload_date DESC
      `;
    } else {
      documents = await sql`
        SELECT * FROM payment_documents
        WHERE is_active = true
        ORDER BY upload_date DESC
        LIMIT 100
      `;
    }

    return NextResponse.json(documents);

  } catch (error) {
    console.error('Error fetching payment documents:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
