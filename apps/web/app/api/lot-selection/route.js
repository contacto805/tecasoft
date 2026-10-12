import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get('lotId');

  if (lotId) {
    // Get selection results for a specific lot
    const results = await sql`
      SELECT * FROM lot_selection_results 
      WHERE lot_id = ${parseInt(lotId)}
      ORDER BY created_at DESC
    `;
    
    const summary = await sql`
      SELECT * FROM lot_selection_summary 
      WHERE lot_id = ${parseInt(lotId)}
    `;

    return NextResponse.json({
      results,
      summary: summary[0] || null
    });
  }

  // Get all lots with selection results
  const lotsWithResults = await sql`
    SELECT 
      l.*,
      COUNT(lsr.id) as selection_count,
      lss.total_price_obtained,
      lss.purchase_price,
      lss.incentive_status
    FROM lots l
    LEFT JOIN lot_selection_results lsr ON l.id = lsr.lot_id
    LEFT JOIN lot_selection_summary lss ON l.id = lss.lot_id
    GROUP BY l.id, lss.id
    ORDER BY l.created_at DESC
  `;

  return NextResponse.json(lotsWithResults);
}

export async function POST(request) {
  const { lotId, selections, purchasePrice } = await request.json();

  // Calculate total price obtained from all calibers
  let totalPriceObtained = 0;
  
  for (const selection of selections) {
    const { caliber, percentage, pricePerCaliber } = selection;
    
    // Insert or update selection result
    await sql`
      INSERT INTO lot_selection_results (lot_id, caliber, percentage, price_per_caliber)
      VALUES (${lotId}, ${caliber}, ${percentage}, ${parseFloat(pricePerCaliber)})
    `;

    // Add to total (weighted average)
    totalPriceObtained += (percentage / 100) * parseFloat(pricePerCaliber);
  }

  // Determine incentive status
  const incentiveStatus = totalPriceObtained >= purchasePrice ? 'approved' : 'rejected';

  // Insert or update summary
  await sql`
    INSERT INTO lot_selection_summary (lot_id, total_price_obtained, purchase_price, incentive_status)
    VALUES (${lotId}, ${totalPriceObtained}, ${purchasePrice}, ${incentiveStatus})
    ON CONFLICT (lot_id) DO UPDATE SET
      total_price_obtained = ${totalPriceObtained},
      purchase_price = ${purchasePrice},
      incentive_status = ${incentiveStatus},
      updated_at = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({
    success: true,
    totalPriceObtained,
    incentiveStatus,
    message: incentiveStatus === 'approved' 
      ? 'Resultado aprobado: precio obtenido ≥ precio de compra' 
      : 'Resultado rechazado: precio obtenido < precio de compra'
  });
}

export async function PUT(request) {
  const { lotId, selections, purchasePrice } = await request.json();

  // Delete old results for this lot
  await sql`DELETE FROM lot_selection_results WHERE lot_id = ${lotId}`;

  // Recalculate and insert new results
  let totalPriceObtained = 0;
  
  for (const selection of selections) {
    const { caliber, percentage, pricePerCaliber } = selection;
    
    await sql`
      INSERT INTO lot_selection_results (lot_id, caliber, percentage, price_per_caliber)
      VALUES (${lotId}, ${caliber}, ${percentage}, ${parseFloat(pricePerCaliber)})
    `;

    totalPriceObtained += (percentage / 100) * parseFloat(pricePerCaliber);
  }

  const incentiveStatus = totalPriceObtained >= purchasePrice ? 'approved' : 'rejected';

  await sql`
    UPDATE lot_selection_summary 
    SET total_price_obtained = ${totalPriceObtained},
        purchase_price = ${purchasePrice},
        incentive_status = ${incentiveStatus},
        updated_at = CURRENT_TIMESTAMP
    WHERE lot_id = ${lotId}
  `;

  return NextResponse.json({
    success: true,
    totalPriceObtained,
    incentiveStatus
  });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get('lotId');

  await sql`DELETE FROM lot_selection_results WHERE lot_id = ${lotId}`;
  await sql`DELETE FROM lot_selection_summary WHERE lot_id = ${lotId}`;

  return NextResponse.json({ success: true });
}
