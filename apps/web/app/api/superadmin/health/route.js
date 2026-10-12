import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const issues = [];

    // Lotes sin productor
    const noProducer = await sql`
      SELECT id, lot_number FROM lots 
      WHERE (producer IS NULL OR producer = '') AND (status IS NULL OR status != 'cancelled')
      LIMIT 20
    `;
    if (noProducer.length) issues.push({ type: 'lotes_sin_productor', count: noProducer.length, samples: noProducer });

    // Inventarios negativos
    const negInv = await sql`
      SELECT lot_id, caliber, total_kg FROM lot_inventory WHERE total_kg < 0 LIMIT 10
    `;
    if (negInv.length) issues.push({ type: 'inventario_negativo', count: negInv.length, samples: negInv });

    // Lotes sin pesaje
    const noWeigh = await sql`
      SELECT l.id, l.lot_number FROM lots l
      LEFT JOIN fruit_input_weighings w ON w.lot_id = l.id
      WHERE w.id IS NULL AND (l.status IS NULL OR l.status != 'cancelled')
      LIMIT 20
    `;
    if (noWeigh.length) issues.push({ type: 'lotes_sin_pesaje', count: noWeigh.length, samples: noWeigh });

    // Tarimas sin ubicación (usando box/pallet tables)
    const noLoc = await sql`
      SELECT COUNT(*)::int as c FROM box_control_movements 
      WHERE (location IS NULL OR location = '') AND status = 'active'
    `;
    if (noLoc[0] && noLoc[0].c > 0) issues.push({ type: 'cajas_sin_ubicacion', count: noLoc[0].c });

    // QR sin entidad
    const orphanQr = await sql`
      SELECT code FROM qr_codes 
      WHERE (lot_id IS NULL AND material_id IS NULL AND box_id IS NULL)
      LIMIT 10
    `;
    if (orphanQr.length) issues.push({ type: 'qr_huerfanos', count: orphanQr.length, samples: orphanQr });

    // Movimientos sin usuario
    const noUserMov = await sql`
      SELECT COUNT(*)::int as c FROM movements WHERE user_id IS NULL OR user_name IS NULL
    `;
    if (noUserMov[0] && noUserMov[0].c > 0) issues.push({ type: 'movimientos_sin_usuario', count: noUserMov[0].c });

    // Materiales con stock negativo
    const negMat = await sql`
      SELECT material_name, quantity_available FROM materials_inventory WHERE quantity_available < 0 LIMIT 10
    `;
    if (negMat.length) issues.push({ type: 'materiales_stock_negativo', count: negMat.length, samples: negMat });

    // Lots con diferencia kg grande (simple check)
    const lotDiff = await sql`
      SELECT id, lot_number, total_kg_received, total_kg_packed, total_kg_process, total_kg_waste 
      FROM lots 
      WHERE ABS(COALESCE(total_kg_received,0) - (COALESCE(total_kg_packed,0)+COALESCE(total_kg_process,0)+COALESCE(total_kg_waste,0))) > 5
      LIMIT 10
    `;
    if (lotDiff.length) issues.push({ type: 'diferencia_kg_lote', count: lotDiff.length, samples: lotDiff });

    return NextResponse.json({ issues, checked_at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ issues: [], error: e.message }, { status: 200 });
  }
}
