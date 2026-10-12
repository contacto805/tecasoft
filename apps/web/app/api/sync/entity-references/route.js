import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * API para obtener referencias de una entidad en todos los módulos
 * Por ejemplo: Si pido referencias del lote #123, me dice dónde aparece
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('type');      // 'lot', 'material', 'caliber'
    const entityId = searchParams.get('id');          // ID de la entidad

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'type e id son requeridos' },
        { status: 400 }
      );
    }

    const references = {};

    // ===== LOTES - Buscar en todos los módulos donde aparecen =====
    if (entityType === 'lot') {
      const lotId = parseInt(entityId);

      // 1. En lot_selection (Selección de Calibres)
      const lotSelection = await sql`
        SELECT * FROM lot_selection_summary WHERE lot_id = ${lotId}
      `;
      if (lotSelection.length > 0) {
        references.lot_selection = {
          module: 'Lotification (Selección)',
          count: lotSelection.length,
          data: lotSelection
        };
      }

      // 2. En lotification_records (Registro de Lotificación)
      const lotifRecords = await sql`
        SELECT * FROM lotification_records WHERE lot_id = ${lotId}
      `;
      if (lotifRecords.length > 0) {
        references.lotification_records = {
          module: 'Lotification (Registros)',
          count: lotifRecords.length,
          data: lotifRecords
        };
      }

      // 3. En lotification_registry (Registro de Lotificación General)
      const lotifRegistry = await sql`
        SELECT * FROM lotification_registry WHERE lot_id = ${lotId}
      `;
      if (lotifRegistry.length > 0) {
        references.lotification_registry = {
          module: 'Lotification (Registro General)',
          count: lotifRegistry.length,
          data: lotifRegistry
        };
      }

      // 4. En cutting_orders (Órdenes de Corte)
      const cuttingOrders = await sql`
        SELECT * FROM cutting_orders WHERE lot_id = ${lotId}
      `;
      if (cuttingOrders.length > 0) {
        references.cutting_orders = {
          module: 'Cutting Orders',
          count: cuttingOrders.length,
          data: cuttingOrders
        };
      }

      // 5. En production_batches (Producción)
      const productionBatches = await sql`
        SELECT * FROM production_batches WHERE lot_id = ${lotId}
      `;
      if (productionBatches.length > 0) {
        references.production_batches = {
          module: 'Production',
          count: productionBatches.length,
          data: productionBatches
        };
      }

      // 6. En sales_of_process_and_waste (Ventas Proceso/Desecho)
      const sales = await sql`
        SELECT * FROM sales_of_process_and_waste WHERE lot_id = ${lotId}
      `;
      if (sales.length > 0) {
        references.sales = {
          module: 'Sales (Proceso & Desecho)',
          count: sales.length,
          data: sales
        };
      }

      // 7. En inventory (Almacén)
      const inventory = await sql`
        SELECT * FROM inventory_barcodes WHERE lot_id = ${lotId}
      `;
      if (inventory.length > 0) {
        references.inventory = {
          module: 'Inventory',
          count: inventory.length,
          data: inventory
        };
      }

      // 8. En public_lot_links (Dashboard Público)
      const publicLinks = await sql`
        SELECT * FROM public_lot_links WHERE lot_id = ${lotId}
      `;
      if (publicLinks.length > 0) {
        references.public_links = {
          module: 'Public Dashboard',
          count: publicLinks.length,
          data: publicLinks
        };
      }

      // 9. En weighings (Pesajes)
      const weighings = await sql`
        SELECT * FROM weighings WHERE lot_id = ${lotId}
      `;
      if (weighings.length > 0) {
        references.weighings = {
          module: 'Weighings',
          count: weighings.length,
          data: weighings
        };
      }

      // 10. En fruit_input_weighings (Pesajes de Entrada)
      const fruitInputWeighings = await sql`
        SELECT * FROM fruit_input_weighings WHERE lot_id = ${lotId}
      `;
      if (fruitInputWeighings.length > 0) {
        references.fruit_input_weighings = {
          module: 'Fruit Input Weighings',
          count: fruitInputWeighings.length,
          data: fruitInputWeighings
        };
      }

      // 11. En thermal_labels (Etiquetas Térmicas)
      const thermalLabels = await sql`
        SELECT * FROM thermal_labels WHERE lot_id = ${lotId}
      `;
      if (thermalLabels.length > 0) {
        references.thermal_labels = {
          module: 'Thermal Labels',
          count: thermalLabels.length,
          data: thermalLabels
        };
      }

      // 12. En broker_payments (Pagos a Corredores)
      const brokerPayments = await sql`
        SELECT * FROM broker_payments WHERE lot_id = ${lotId}
      `;
      if (brokerPayments.length > 0) {
        references.broker_payments = {
          module: 'Broker Payments',
          count: brokerPayments.length,
          data: brokerPayments
        };
      }

      // 13. En combustible_cargas (Control de Combustible - trazabilidad de cargas vinculadas)
      const combustible = await sql`
        SELECT * FROM combustible_cargas WHERE lote_id = ${lotId} OR huerta_id IN (SELECT id FROM orchards WHERE producer ILIKE (SELECT producer FROM lots WHERE id=${lotId} LIMIT 1))
        LIMIT 20
      `;
      if (combustible.length > 0) {
        references.combustible = {
          module: 'Combustible (Cargas)',
          count: combustible.length,
          data: combustible
        };
      }

      // 14. En orchard_visits / acopios (trazabilidad de origen)
      const acopios = await sql`
        SELECT * FROM orchard_visits WHERE lot_id = ${lotId} OR producer ILIKE (SELECT producer FROM lots WHERE id=${lotId} LIMIT 1) LIMIT 10
      `;
      if (acopios.length > 0) {
        references.acopios = { module: 'Acopios / Visitas', count: acopios.length, data: acopios };
      }

      // 15. En cartera / notas / viajes (trazabilidad comercial)
      const cartera = await sql`
        SELECT * FROM notas WHERE viaje_id IN (SELECT id FROM viajes WHERE lotes::text ILIKE '%' || ${lotId} || '%') OR (SELECT lot_number FROM lots WHERE id=${lotId}) ILIKE '%'
        LIMIT 10
      `;
      if (cartera.length > 0) {
        references.cartera = { module: 'Cartera / Notas', count: cartera.length, data: cartera };
      }
    }

    // ===== MATERIALES - Buscar en todos los módulos donde se usan =====
    else if (entityType === 'material') {
      const materialId = parseInt(entityId);

      // 1. En material_deductions (Deducción de Materiales en Producción)
      const deductions = await sql`
        SELECT * FROM material_deductions WHERE material_id = ${materialId}
      `;
      if (deductions.length > 0) {
        references.material_deductions = {
          module: 'Production (Deductions)',
          count: deductions.length,
          data: deductions
        };
      }

      // 2. En expenses (Gastos - si se registró ahí)
      // Nota: expenses registra el producto como texto, no como FK
    }

    // ===== CALIBRES - Buscar en todos los módulos donde se usan =====
    else if (entityType === 'caliber') {
      const caliberId = parseInt(entityId);

      // 1. En lot_selection_results (Resultados de Selección por Calibre)
      const selectionResults = await sql`
        SELECT * FROM lot_selection_results WHERE id = ${caliberId}
      `;
      if (selectionResults.length > 0) {
        references.selection_results = {
          module: 'Lot Selection',
          count: selectionResults.length,
          data: selectionResults
        };
      }

      // 2. En production_selection_details (Detalles de Selección en Producción)
      const productionDetails = await sql`
        SELECT * FROM production_selection_details WHERE id = ${caliberId}
      `;
      if (productionDetails.length > 0) {
        references.production_details = {
          module: 'Production Selection',
          count: productionDetails.length,
          data: productionDetails
        };
      }

      // 3. En pallet_output_summary (Resumen de Pallets)
      const palletOutput = await sql`
        SELECT * FROM pallet_output_summary WHERE id = ${caliberId}
      `;
      if (palletOutput.length > 0) {
        references.pallet_output = {
          module: 'Pallet Output',
          count: palletOutput.length,
          data: palletOutput
        };
      }
    }

    // ===== CAMBIOS RECIENTES DE ESTA ENTIDAD =====
    const auditLog = await sql`
      SELECT * FROM sync_audit_log 
      WHERE entity_type = ${entityType} AND entity_id = ${parseInt(entityId)}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      entityType,
      entityId: parseInt(entityId),
      references: references,
      totalReferences: Object.keys(references).length,
      recentChanges: auditLog,
      lastModified: auditLog.length > 0 ? auditLog[0].created_at : null
    });

  } catch (error) {
    console.error('Error en GET entity references:', error);
    return NextResponse.json(
      { error: 'Error obteniendo referencias: ' + error.message },
      { status: 500 }
    );
  }
}
