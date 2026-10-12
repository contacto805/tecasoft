import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API de Sincronización de Movimientos
 * Sincroniza automáticamente datos de otras tablas a daily_movements
 */

export async function POST(request) {
  try {
    const { syncDate } = await request.json();
    const targetDate = syncDate || new Date().toISOString().split('T')[0];

    let syncedCount = 0;

    // 1. Sincronizar ventas de cargas (load_history)
    const loads = await sql`
      SELECT 
        id,
        load_date,
        customer_name,
        total_kg,
        total_amount,
        currency
      FROM load_history
      WHERE load_date = ${targetDate}
    `;

    for (const load of loads) {
      // Verificar si ya existe
      const existing = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'load' 
        AND related_entity_id = ${load.id}
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id,
            currency
          ) VALUES (
            ${load.load_date},
            'INGRESO',
            'Venta Principal',
            ${`Venta a ${load.customer_name} - ${load.total_kg} kg`},
            ${load.total_amount},
            'load',
            ${load.id},
            ${load.currency || 'MXN'}
          )
        `;
        syncedCount++;
      }
    }

    // 2. Sincronizar ventas de proceso y desecho
    const processWasteSales = await sql`
      SELECT 
        id,
        date,
        buyer_name,
        process_kg,
        waste_kg,
        total_price
      FROM sales_of_process_and_waste
      WHERE date = ${targetDate}
    `;

    for (const sale of processWasteSales) {
      const existing = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'process_waste_sale' 
        AND related_entity_id = ${sale.id}
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id
          ) VALUES (
            ${sale.date},
            'INGRESO',
            ${sale.process_kg > 0 ? 'Venta Proceso' : 'Venta Desecho'},
            ${`Venta a ${sale.buyer_name} - ${sale.process_kg + sale.waste_kg} kg`},
            ${sale.total_price},
            'process_waste_sale',
            ${sale.id}
          )
        `;
        syncedCount++;
      }
    }

    // 3. Sincronizar gastos operativos
    const expenses = await sql`
      SELECT 
        id,
        expense_date,
        product_name,
        department,
        total
      FROM expenses
      WHERE expense_date = ${targetDate}
    `;

    for (const expense of expenses) {
      const existing = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'expense' 
        AND related_entity_id = ${expense.id}
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id
          ) VALUES (
            ${expense.expense_date},
            'EGRESO',
            ${`Gasto ${expense.department}`},
            ${expense.product_name},
            ${expense.total},
            'expense',
            ${expense.id}
          )
        `;
        syncedCount++;
      }
    }

    // 4. Sincronizar compras de fruta (lots)
    const lots = await sql`
      SELECT 
        id,
        lot_number,
        date,
        producer,
        total_kg_received,
        fruit_price,
        commission_amount
      FROM lots
      WHERE date = ${targetDate}
    `;

    for (const lot of lots) {
      const totalCost = (lot.total_kg_received || 0) * (lot.fruit_price || 0);
      
      // Costo de fruta
      const existingFruit = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'lot_fruit_purchase' 
        AND related_entity_id = ${lot.id}
      `;

      if (existingFruit.length === 0 && totalCost > 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id,
            lot_id
          ) VALUES (
            ${lot.date},
            'EGRESO',
            'Compra Fruta',
            ${`Lote ${lot.lot_number} - ${lot.producer} - ${lot.total_kg_received} kg`},
            ${totalCost},
            'lot_fruit_purchase',
            ${lot.id},
            ${lot.id}
          )
        `;
        syncedCount++;
      }

      // Comisión de corredor
      if (lot.commission_amount > 0) {
        const existingCommission = await sql`
          SELECT id FROM daily_movements
          WHERE related_entity_type = 'lot_commission' 
          AND related_entity_id = ${lot.id}
        `;

        if (existingCommission.length === 0) {
          await sql`
            INSERT INTO daily_movements (
              movement_date,
              movement_type,
              category,
              description,
              amount,
              related_entity_type,
              related_entity_id,
              lot_id
            ) VALUES (
              ${lot.date},
              'EGRESO',
              'Comisión Corredor',
              ${`Comisión lote ${lot.lot_number}`},
              ${lot.commission_amount},
              'lot_commission',
              ${lot.id},
              ${lot.id}
            )
          `;
          syncedCount++;
        }
      }
    }

    // 5. Sincronizar fletes foráneos
    const freights = await sql`
      SELECT 
        id,
        freight_date,
        driver_name,
        freight_amount
      FROM foreign_freights
      WHERE freight_date = ${targetDate}
    `;

    for (const freight of freights) {
      const existing = await sql`
        SELECT id FROM daily_movements
        WHERE related_entity_type = 'foreign_freight' 
        AND related_entity_id = ${freight.id}
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO daily_movements (
            movement_date,
            movement_type,
            category,
            description,
            amount,
            related_entity_type,
            related_entity_id
          ) VALUES (
            ${freight.freight_date},
            'EGRESO',
            'Flete Foráneo',
            ${`Flete - ${freight.driver_name}`},
            ${freight.freight_amount},
            'foreign_freight',
            ${freight.id}
          )
        `;
        syncedCount++;
      }
    }

    return NextResponse.json({
      message: 'Sincronización completada',
      syncedDate: targetDate,
      recordsSynced: syncedCount
    });
  } catch (error) {
    console.error('Error syncing movements:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar movimientos: ' + error.message },
      { status: 500 }
    );
  }
}
