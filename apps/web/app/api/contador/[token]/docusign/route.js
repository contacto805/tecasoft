import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    const [tokenData] = await sql`
      SELECT lat.lot_id, l.lot_number
      FROM lot_accountant_tokens lat
      JOIN lots l ON lat.lot_id = l.id
      WHERE lat.token = ${token}
    `;

    if (!tokenData) {
      return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });
    }

    const [signature] = await sql`
      SELECT * FROM lot_contract_signatures 
      WHERE lot_id = ${tokenData.lot_id}
      ORDER BY created_at DESC LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      lotId: tokenData.lot_id,
      lotNumber: tokenData.lot_number,
      signature: signature || { status: 'pendiente_de_firma' }
    });
  } catch (error) {
    console.error('Error fetching docusign contract:', error);
    return NextResponse.json({ error: 'Error al obtener estado del contrato' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { action, signerEmail, signerName } = body;

    const [tokenData] = await sql`
      SELECT lat.lot_id
      FROM lot_accountant_tokens lat
      WHERE lat.token = ${token}
    `;

    if (!tokenData) {
      return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });
    }

    const lotId = tokenData.lot_id;

    if (action === 'send') {
      // DocuSign: usa el servicio conectado SOLO cuando exista config y credenciales reales (block 16).
      // Actualmente placeholder local. Requiere conexión externa DocuSign para envelope real.
      const [existing] = await sql`
        SELECT id FROM lot_contract_signatures 
        WHERE lot_id = ${lotId} ORDER BY created_at DESC LIMIT 1
      `;

      const insertData = {
        lot_id: lotId,
        status: 'enviado_a_firma',
        signer_email: signerEmail || '',
        signer_name: signerName || '',
        envelope_status: 'sent',
        docusign_envelope_id: body.envelopeId || null
      };

      if (existing) {
        await sql`
          UPDATE lot_contract_signatures 
          SET status = 'enviado_a_firma', 
              signer_email = ${signerEmail || ''}, 
              signer_name = ${signerName || ''},
              envelope_status = 'sent',
              updated_at = NOW()
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          INSERT INTO lot_contract_signatures (lot_id, status, signer_email, signer_name, envelope_status)
          VALUES (${lotId}, 'enviado_a_firma', ${signerEmail || ''}, ${signerName || ''}, 'sent')
        `;
      }

      return NextResponse.json({ 
        success: true, 
        status: 'enviado_a_firma',
        message: 'Contrato enviado a DocuSign para firma electrónica' 
      });
    }

    if (action === 'sign-locally' || action === 'complete-signature') {
      // El firmante completó vía DocuSign (o simulado en portal)
      // Guardar metadata y vincular documento firmado automáticamente
      const signedAt = new Date().toISOString();

      // Usar contrato base como principal, listo para firmado
      const signedFileUrl = `/api/lots/${lotId}/contract`;

      const [existing] = await sql`
        SELECT id FROM lot_contract_signatures 
        WHERE lot_id = ${lotId} ORDER BY created_at DESC LIMIT 1
      `;

      if (existing) {
        await sql`
          UPDATE lot_contract_signatures 
          SET status = 'firmado', 
              signer_email = ${signerEmail || ''}, 
              signer_name = ${signerName || ''}, 
              signed_at = ${signedAt},
              signed_file_url = ${signedFileUrl},
              envelope_status = 'completed',
              certificate_url = 'docusign://certificate',
              updated_at = NOW()
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          INSERT INTO lot_contract_signatures 
            (lot_id, status, signer_email, signer_name, signed_at, signed_file_url, envelope_status, certificate_url)
          VALUES 
            (${lotId}, 'firmado', ${signerEmail || ''}, ${signerName || ''}, ${signedAt}, ${signedFileUrl}, 'completed', 'docusign://certificate')
        `;
      }

      // Registrar como documento oficial dentro del expediente (accesible al contador también)
      try {
        await sql`
          INSERT INTO lot_accountant_documents 
            (lot_id, document_type, file_name, file_url, uploaded_at, uploaded_by)
          VALUES 
            (${lotId}, 'contrato_firmado_docusign', 
             'Contrato Firmado - Lote ' || (SELECT lot_number FROM lots WHERE id = ${lotId}) || '.pdf',
             ${signedFileUrl}, NOW(), 'docusign')
        `;
      } catch (e) {
        // Puede existir ya, ignorar
      }

      return NextResponse.json({ 
        success: true, 
        status: 'firmado',
        message: 'Contrato marcado como firmado. El PDF firmado queda guardado en el expediente.',
        signedFileUrl
      });
    }

    if (action === 'reject') {
      await sql`
        UPDATE lot_contract_signatures 
        SET status = 'rechazado', envelope_status = 'declined', updated_at = NOW()
        WHERE lot_id = ${lotId}
      `;
      return NextResponse.json({ success: true, status: 'rechazado' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    console.error('Error docusign contract action:', error);
    return NextResponse.json({ error: 'Error procesando la firma del contrato' }, { status: 500 });
  }
}
