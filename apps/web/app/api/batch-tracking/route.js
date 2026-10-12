import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (lotId) {
      // Get detailed batch tracking for a specific lot
      const lot = await sql`
        SELECT * FROM lots WHERE id = ${parseInt(lotId)}
      `;

      if (!lot.length) {
        return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
      }

      const lotData = lot[0];

      // Get weighings data
      const weighings = await sql`
        SELECT 
          id,
          boxes,
          gross_weight,
          net_weight,
          with_pallet,
          tare_weight,
          timestamp
        FROM weighings 
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY timestamp ASC
      `;

      // Get cutting orders data
      const cuttingOrders = await sql`
        SELECT 
          id,
          folio,
          boxes_count,
          returned_boxes,
          missing_boxes,
          gross_weight,
          net_weight,
          status
        FROM cutting_orders
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY created_at ASC
      `;

      // Get lotification registry (processing/classification)
      const lotificationRegistry = await sql`
        SELECT 
          id,
          selection_date,
          total_kilos_received,
          total_kilos_by_caliber,
          real_price_per_lot
        FROM lotification_registry
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY created_at ASC
      `;

      // Get lotification records (yield data)
      const lotificationRecords = await sql`
        SELECT 
          id,
          total_kg_processed,
          total_kg_waste,
          total_kg_loss,
          notes
        FROM lotification_records
        WHERE lot_id = ${parseInt(lotId)}
        LIMIT 1
      `;

      // Get sales data
      const sales = await sql`
        SELECT 
          id,
          buyer_name,
          destination,
          sales_folio,
          product_name,
          process_kg,
          waste_kg,
          unit_price,
          total_price,
          calculated_price,
          date
        FROM sales_of_process_and_waste
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY created_at ASC
      `;

      // Calculate batch totals
      const totalWeighingKg = weighings.reduce((sum, w) => sum + (parseFloat(w.net_weight) || 0), 0);
      const totalBoxesCut = cuttingOrders.reduce((sum, c) => sum + (c.boxes_count || 0), 0);
      const totalBoxesReturned = cuttingOrders.reduce((sum, c) => sum + (c.returned_boxes || 0), 0);
      const totalBoxesMissing = cuttingOrders.reduce((sum, c) => sum + (c.missing_boxes || 0), 0);

      const yield_data = lotificationRecords[0] || {};
      const totalKgProcessed = parseFloat(yield_data.total_kg_processed) || 0;
      const totalKgWaste = parseFloat(yield_data.total_kg_waste) || 0;
      const totalKgLoss = parseFloat(yield_data.total_kg_loss) || 0;

      // Calculate costs
      const inputCost = totalWeighingKg * (parseFloat(lotData.fruit_price) || 0);
      const commissionCost = (parseFloat(lotData.commission_amount) || 0);
      const totalCost = inputCost + commissionCost;

      // Calculate revenue
      const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.calculated_price) || parseFloat(s.total_price) || 0), 0);

      // Calculate profit/loss
      const profit = totalRevenue - totalCost;
      const profitMargin = totalCost > 0 ? ((profit / totalCost) * 100) : 0;

      // Calculate yield percentage
      const yieldPercentage = totalWeighingKg > 0 ? ((totalKgProcessed / totalWeighingKg) * 100) : 0;

      // Prepare batch journey checkpoints
      const checkpoints = [
        {
          stage: "Ingreso",
          description: "Fruta recibida en empacadora",
          date: lotData.date,
          metric: `${totalWeighingKg.toFixed(2)} kg`,
          status: weighings.length > 0 ? "completado" : "pendiente",
          icon: "📦"
        },
        {
          stage: "Corte",
          description: "Procesamiento y corte de fruta",
          date: cuttingOrders[0]?.created_at || null,
          metric: `${totalBoxesCut} cajas`,
          status: cuttingOrders.length > 0 ? "completado" : "pendiente",
          subMetrics: {
            returned: totalBoxesReturned,
            missing: totalBoxesMissing
          },
          icon: "✂️"
        },
        {
          stage: "Clasificación",
          description: "Selección y clasificación por calibre",
          date: lotificationRegistry[0]?.selection_date || null,
          metric: `${totalKgProcessed.toFixed(2)} kg procesados`,
          status: lotificationRegistry.length > 0 ? "completado" : "pendiente",
          subMetrics: {
            waste: totalKgWaste,
            loss: totalKgLoss,
            yieldPercentage: yieldPercentage.toFixed(2)
          },
          icon: "📊"
        },
        {
          stage: "Venta",
          description: "Venta de producto y merma",
          date: sales[0]?.date || null,
          metric: `${sales.length} registro(s) de venta`,
          status: sales.length > 0 ? "completado" : "pendiente",
          revenue: totalRevenue,
          icon: "💰"
        }
      ];

      return NextResponse.json({
        lot: lotData,
        checkpoints,
        weighings,
        cuttingOrders,
        lotificationRegistry,
        lotificationRecords: yield_data,
        sales,
        summary: {
          totalWeighingKg,
          totalKgProcessed,
          totalKgWaste,
          totalKgLoss,
          yieldPercentage,
          inputCost,
          commissionCost,
          totalCost,
          totalRevenue,
          profit,
          profitMargin
        }
      });
    }

    // Get summary for all lots
    const allLots = await sql`
      SELECT 
        l.id,
        l.lot_number,
        l.producer,
        l.fruit_type,
        l.date,
        l.fruit_price,
        l.commission_amount,
        COUNT(DISTINCT w.id) as weighing_count,
        SUM(w.net_weight) as total_kg_weighed,
        COUNT(DISTINCT co.id) as cutting_order_count,
        COUNT(DISTINCT spw.id) as sales_count
      FROM lots l
      LEFT JOIN weighings w ON l.id = w.lot_id
      LEFT JOIN cutting_orders co ON l.id = co.lot_id
      LEFT JOIN sales_of_process_and_waste spw ON l.id = spw.lot_id
      GROUP BY l.id, l.lot_number, l.producer, l.fruit_type, l.date, l.fruit_price, l.commission_amount
      ORDER BY l.date DESC
      LIMIT 50
    `;

    // Calculate profitability for each lot
    const lotsWithProfitability = await Promise.all(
      allLots.map(async (lot) => {
        const sales = await sql`
          SELECT 
            SUM(COALESCE(calculated_price, total_price, 0)) as total_revenue
          FROM sales_of_process_and_waste
          WHERE lot_id = ${lot.id}
        `;

        const totalWeightKg = parseFloat(lot.total_kg_weighed) || 0;
        const inputCost = totalWeightKg * (parseFloat(lot.fruit_price) || 0);
        const commissionCost = parseFloat(lot.commission_amount) || 0;
        const totalCost = inputCost + commissionCost;
        const totalRevenue = parseFloat(sales[0]?.total_revenue) || 0;
        const profit = totalRevenue - totalCost;

        return {
          id: lot.id,
          lot_number: lot.lot_number,
          producer: lot.producer,
          fruit_type: lot.fruit_type,
          date: lot.date,
          totalKg: totalWeightKg,
          cost: totalCost,
          revenue: totalRevenue,
          profit,
          profitMargin: totalCost > 0 ? ((profit / totalCost) * 100) : 0,
          status: lot.sales_count > 0 ? "completado" : lot.cutting_order_count > 0 ? "en_proceso" : "iniciado"
        };
      })
    );

    return NextResponse.json(lotsWithProfitability);
  } catch (error) {
    console.error("Error in batch tracking GET:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
