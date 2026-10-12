import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    // Verificar token (prefer tokens table) + fallback por accountant_code del lote (para enlaces antiguos)
    let [tokenData] = await sql`
      SELECT 
        lat.id as token_id,
        lat.lot_id,
        lat.access_count,
        l.lot_number,
        l.producer,
        l.producer as producer_name,
        l.broker_name,
        l.orchard_name,
        l.municipality,
        l.date as cutting_date,
        l.total_kg_received as total_weight_kg,
        l.fruit_price as price_per_kg
      FROM lot_accountant_tokens lat
      JOIN lots l ON lat.lot_id = l.id
      WHERE lat.token = ${token}
    `;

    if (!tokenData) {
      const [byCode] = await sql`
        SELECT 
          l.id as lot_id,
          l.lot_number,
          l.producer as producer_name,
          l.broker_name,
          l.orchard_name,
          l.municipality,
          l.date as cutting_date,
          l.total_kg_received as total_weight_kg,
          l.fruit_price as price_per_kg,
          0 as access_count
        FROM lots l
        WHERE l.accountant_code = ${token}
        LIMIT 1
      `;
      if (byCode) {
        tokenData = byCode;
        // accountant_code legacy fallback: view is granted. Admin generate creates proper entry via link endpoint
      }
    }

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Enlace inválido o expirado' },
        { status: 404 }
      );
    }

    // If from main token table (had token_id) increment count
    if (tokenData.token_id != null) {
      await sql`
        UPDATE lot_accountant_tokens 
        SET access_count = access_count + 1,
            accessed_at = NOW()
        WHERE token = ${token}
      `;
    }

    // Obtener documentos ya subidos
    const documents = await sql`
      SELECT 
        id,
        document_type,
        file_name,
        file_url,
        uploaded_at
      FROM lot_accountant_documents
      WHERE lot_id = ${tokenData.lot_id}
      ORDER BY uploaded_at DESC
    `;

    // Pesadas y nota de entrada (fruit)
    const [notaEntrada] = await sql`
      SELECT 
        total_kg_weighed,
        public_scale_date,
        reception_responsible,
        notes as reception_notes
      FROM fruit_input_weighings
      WHERE lot_id = ${tokenData.lot_id}
      LIMIT 1
    `;

    const pesadas = await sql`
      SELECT id, boxes, gross_weight, net_weight, with_pallet, tare_weight, timestamp, photo_url
      FROM weighings 
      WHERE lot_id = ${tokenData.lot_id} 
      ORDER BY timestamp ASC
      LIMIT 30
    `;

    return NextResponse.json({
      lot: tokenData,
      documents,
      notaEntrada: notaEntrada || null,
      pesadas: pesadas || []
    });
  } catch (error) {
    console.error('Error fetching accountant data:', error);
    return NextResponse.json(
      { error: 'Error al cargar información del lote' },
      { status: 500 }
    );
  }
}
