import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: 'Lot ID requerido' }, { status: 400 });
    }

    // Get or create lot cost summary
    let [summary] = await sql`
      SELECT * FROM lot_cost_summary WHERE lot_id = ${lotId}
    `;

    if (!summary) {
      [summary] = await sql`
        INSERT INTO lot_cost_summary (lot_id)
        VALUES (${lotId})
        RETURNING *
      `;
    }

    // Calculate costs by category
    const directCosts = await sql`
      SELECT 
        cost_category,
        SUM(amount_mxn) as total
      FROM operating_costs
      WHERE lot_id = ${lotId}
        AND cost_type = 'directo_lote'
        AND status = 'aprobado'
      GROUP BY cost_category
    `;

    const packingCosts = await sql`
      SELECT 
        cost_category,
        SUM(amount_mxn) as total
      FROM operating_costs
      WHERE lot_id = ${lotId}
        AND cost_type = 'empacado'
        AND status = 'aprobado'
      GROUP BY cost_category
    `;

    const indirectCosts = await sql`
      SELECT SUM(distributed_amount) as total
      FROM cost_distribution_log
      WHERE lot_id = ${lotId}
    `;

    // Get lot data
    const [lot] = await sql`
      SELECT 
        total_kg_received,
        total_kg_packed,
        total_revenue,
        total_cost
      FROM lots
      WHERE id = ${lotId}
    `;

    // Calculate totals
    const totalDirectCosts = directCosts.reduce((sum, c) => sum + parseFloat(c.total || 0), 0);
    const totalPackingCosts = packingCosts.reduce((sum, c) => sum + parseFloat(c.total || 0), 0);
    const totalIndirectCosts = parseFloat(indirectCosts[0]?.total || 0);
    const totalAllCosts = totalDirectCosts + totalPackingCosts + totalIndirectCosts;

    const costPerKgReceived = lot?.total_kg_received ? totalAllCosts / lot.total_kg_received : 0;
    const costPerKgPacked = lot?.total_kg_packed ? totalAllCosts / lot.total_kg_packed : 0;

    // Update summary
    await sql`
      UPDATE lot_cost_summary
      SET
        total_direct_costs = ${totalDirectCosts},
        total_production_costs = ${totalPackingCosts},
        total_indirect_costs = ${totalIndirectCosts},
        total_all_costs = ${totalAllCosts},
        total_kg_received = ${lot?.total_kg_received || 0},
        total_kg_packed = ${lot?.total_kg_packed || 0},
        cost_per_kg_received = ${costPerKgReceived},
        cost_per_kg_packed = ${costPerKgPacked},
        last_calculated = NOW(),
        updated_at = NOW()
      WHERE lot_id = ${lotId}
    `;

    // Get updated summary
    [summary] = await sql`
      SELECT * FROM lot_cost_summary WHERE lot_id = ${lotId}
    `;

    return NextResponse.json({
      ...summary,
      directCostsBreakdown: directCosts,
      packingCostsBreakdown: packingCosts,
      lot: lot
    });
  } catch (error) {
    console.error('Error fetching lot cost summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { lotId } = await request.json();

    // Recalculate all costs for this lot
    // This will be called when costs are added/updated/approved

    // Get all approved costs for this lot
    const costs = await sql`
      SELECT * FROM operating_costs
      WHERE lot_id = ${lotId}
        AND status = 'aprobado'
    `;

    // Update lot totals
    const totalCost = costs.reduce((sum, c) => sum + parseFloat(c.amount_mxn || 0), 0);

    await sql`
      UPDATE lots
      SET total_cost = ${totalCost}
      WHERE id = ${lotId}
    `;

    return NextResponse.json({ success: true, totalCost });
  } catch (error) {
    console.error('Error recalculating lot costs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
