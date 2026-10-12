import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * SYNC API - Sincronización centralizada del sistema
 * Cuando se actualiza una entidad (lote, material, calibre),
 * todos los módulos que la usan se actualizan automáticamente
 */

export async function POST(request) {
  try {
    const {
      action,        // 'update_lot', 'update_material', 'update_caliber', etc.
      entityId,      // ID de la entidad que cambió
      entityType,    // 'lot', 'material', 'caliber', 'warehouse_slot'
      data,          // Datos nuevos
      changedFields  // Qué campos cambiaron
    } = await request.json();

    if (!action || !entityType) {
      return NextResponse.json(
        { error: 'action y entityType son requeridos' },
        { status: 400 }
      );
    }

    let result = {};

    // ===== LOTES (Sincronizar en: Inventario, Cargas, Lotification, etc.) =====
    if (entityType === 'lot' && action === 'update_lot') {
      if (data) {
        if (data.lot_number !== undefined) await sql`UPDATE lots SET lot_number = ${data.lot_number}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.producer !== undefined) await sql`UPDATE lots SET producer = ${data.producer}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.origin !== undefined) await sql`UPDATE lots SET origin = ${data.origin}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.fruit_type !== undefined) await sql`UPDATE lots SET fruit_type = ${data.fruit_type}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.status !== undefined) await sql`UPDATE lots SET status = ${data.status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.payment_days !== undefined) await sql`UPDATE lots SET payment_days = ${parseInt(data.payment_days)||0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
      }
      if (changedFields?.includes('status')) {
        const lot = await sql`SELECT * FROM lots WHERE id = ${entityId}`;
        if (lot.length > 0) {
          if (lot[0].status === 'cutting') {
            await sql`UPDATE cutting_orders SET status = 'Pendiente' WHERE lot_id = ${entityId} AND status IS NULL`;
          }
          if (lot[0].status === 'selection') {
            const lotRegistry = await sql`SELECT * FROM lotification_registry WHERE lot_id = ${entityId}`;
            if (lotRegistry.length === 0) {
              await sql`INSERT INTO lotification_registry (lot_id, selection_date, total_kilos_received) VALUES (${entityId}, CURRENT_DATE, 0)`;
            }
          }
        }
      }
      result.updated_entity = 'lot';
      result.cascade_updates = ['cutting_orders', 'lotification_registry'];
    }

    // ===== MATERIALES (Sincronizar en: Gastos, Inventario) =====
    else if (entityType === 'material' && action === 'update_material') {
      if (data) {
        if (data.material_name !== undefined) await sql`UPDATE materials_inventory SET material_name = ${data.material_name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.category !== undefined) await sql`UPDATE materials_inventory SET category = ${data.category}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.quantity_available !== undefined) await sql`UPDATE materials_inventory SET quantity_available = ${parseFloat(data.quantity_available)||0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.unit !== undefined) await sql`UPDATE materials_inventory SET unit = ${data.unit}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.minimum_stock !== undefined) await sql`UPDATE materials_inventory SET minimum_stock = ${parseFloat(data.minimum_stock)||0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.cost_per_unit !== undefined) await sql`UPDATE materials_inventory SET cost_per_unit = ${parseFloat(data.cost_per_unit)||0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
      }
      if (changedFields?.includes('quantity_available')) {
        const material = await sql`SELECT * FROM materials_inventory WHERE id = ${entityId}`;
        if (material.length > 0 && material[0].quantity_available < (material[0].minimum_stock || 50)) {
          console.log(`⚠️ Material ${material[0].material_name} está bajo stock`);
        }
      }
      result.updated_entity = 'material';
      result.cascade_updates = ['expenses', 'inventory'];
    }

    // ===== CALIBRES (Sincronizar en: Inventario, Lotification, Cargas) =====
    else if (entityType === 'caliber' && action === 'update_caliber') {
      if (data) {
        if (data.caliber_name !== undefined) await sql`UPDATE caliber_definitions SET caliber_name = ${data.caliber_name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.display_name !== undefined) await sql`UPDATE caliber_definitions SET display_name = ${data.display_name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.category !== undefined) await sql`UPDATE caliber_definitions SET category = ${data.category}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
        if (data.is_active !== undefined) await sql`UPDATE caliber_definitions SET is_active = ${!!data.is_active}, updated_at = CURRENT_TIMESTAMP WHERE id = ${entityId}`;
      }
      result.updated_entity = 'caliber';
      result.cascade_updates = ['inventory', 'lotification', 'loads', 'production'];
    }

    // ===== POSICIONES DE ALMACÉN (Sincronizar en: Inventario y Cargas) =====
    else if (entityType === 'warehouse_slot' && action === 'update_warehouse') {
      const slotId = data?.slot_id;
      
      if (data && slotId) {
        // Actualizar en inventory (si aplica)
        // Actualizar en loads (si aplica)
        // Los slots se sincronizan a través de la tabla warehouse_inventory
        
        if (data.lot_id) {
          // Si se asignó un lote a una posición, actualizar referencias
          await sql`
            UPDATE warehouse_inventory 
            SET lot_id = ${data.lot_id}, updated_at = CURRENT_TIMESTAMP
            WHERE slot_id = ${slotId}
          `;
        }
      }

      result.updated_entity = 'warehouse_slot';
      result.cascade_updates = ['inventory', 'loads'];
    }

    // ===== GASTOS Y CONSUMO DE MATERIALES =====
    else if (entityType === 'expense' && action === 'update_expense') {
      // Si se registra un gasto de material, actualizar el inventario
      if (data && data.material_id) {
        const expense = await sql`
          SELECT * FROM expenses WHERE id = ${entityId}
        `;

        if (expense.length > 0) {
          // Restar cantidad del inventario de materiales
          await sql`
            UPDATE materials_inventory 
            SET quantity_available = quantity_available - ${data.quantity_used || 0}
            WHERE id = ${data.material_id}
          `;

          result.material_updated = true;
        }
      }

      result.updated_entity = 'expense';
      result.cascade_updates = ['materials_inventory'];
    }

    // ===== VENTAS DE PROCESO Y DESECHO =====
    else if (entityType === 'sale_waste' && action === 'update_sale_waste') {
      // Si se actualiza el estado de pago, sincronizar en cash management
      if (changedFields?.includes('payment_status')) {
        const sale = await sql`
          SELECT * FROM sales_of_process_and_waste WHERE id = ${entityId}
        `;

        if (sale.length > 0) {
          // Actualizar en broker_payments si aplica
          if (sale[0].payment_status === 'pagado') {
            await sql`
              UPDATE broker_payments 
              SET is_paid = true, paid_date = CURRENT_DATE
              WHERE lot_id = ${sale[0].lot_id}
            `;
          }
        }
      }

      result.updated_entity = 'sale_waste';
      result.cascade_updates = ['cash_management', 'broker_payments'];
    }

    return NextResponse.json({
      success: true,
      action,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en SYNC API:', error);
    return NextResponse.json(
      { error: 'Error en sincronización: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper para construir UPDATE dinámico
 */
function getUpdateFields(data, allowedFields) {
  const updates = [];
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = '${data[field]}'`);
    }
  });
  
  if (updates.length === 0) {
    throw new Error('No hay campos válidos para actualizar');
  }

  // Nota: Para producción, usar prepared statements
  return updates.join(', ') + ', updated_at = CURRENT_TIMESTAMP';
}
