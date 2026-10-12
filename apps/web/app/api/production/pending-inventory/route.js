import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all pallet_output_summary records that haven't been assigned to a slot yet
    const pendingItems = await sql`
      SELECT 
        pos.*,
        COALESCE(pos.folio_tarima, 'TAR-' || LPAD(pos.id::text,6,'0')) as folio_tarima,
        COALESCE(pos.estado, 'PENDIENTE_UBICACION') as estado,
        l.lot_number
      FROM pallet_output_summary pos
      LEFT JOIN lots l ON pos.lot_id = l.id
      WHERE (pos.warehouse_slot IS NULL OR pos.warehouse_slot = '')
      AND COALESCE(pos.estado, 'PENDIENTE_UBICACION') NOT IN ('EMBARCADA', 'CANCELADA')
      ORDER BY pos.created_at DESC
    `;

    return NextResponse.json(pendingItems);

  } catch (error) {
    console.error('Error fetching pending inventory items:', error);
    return NextResponse.json(
      { error: error.message || 'Error obteniendo tarimas pendientes' },
      { status: 500 }
    );
  }
}
