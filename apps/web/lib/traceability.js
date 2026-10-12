// Traceability event logging utility
export async function logTraceabilityEvent({
  master_batch_id,
  lot_id,
  event_type,
  event_category,
  event_description,
  related_entity_type,
  related_entity_id,
  material_quantities,
  user_id,
  user_name,
  metadata
}) {
  try {
    const response = await fetch('/api/traceability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        master_batch_id,
        lot_id,
        event_type,
        event_category,
        event_description,
        related_entity_type,
        related_entity_id,
        material_quantities,
        user_id,
        user_name,
        metadata
      })
    });

    if (!response.ok) {
      throw new Error('Failed to log traceability event');
    }

    return await response.json();
  } catch (error) {
    console.error('Error logging traceability event:', error);
    // Don't throw - allow operations to continue even if logging fails
  }
}

// Event type constants
export const TRACEABILITY_EVENTS = {
  // Intake events
  LOT_CREATED: 'lot_created',
  BATCH_CREATED: 'batch_created',
  WEIGHING_RECORDED: 'weighing_recorded',
  FRUIT_RECEIVED: 'fruit_received',
  
  // Cutting events
  CUTTING_ORDER_CREATED: 'cutting_order_created',
  CUTTING_ORDER_COMPLETED: 'cutting_order_completed',
  
  // Production events
  PRODUCTION_STARTED: 'production_started',
  PALLET_CONFIGURED: 'pallet_configured',
  MATERIALS_DEDUCTED: 'materials_deducted',
  PALLET_OUTPUT_RECORDED: 'pallet_output_recorded',
  PRODUCTION_COMPLETED: 'production_completed',
  
  // Inventory events
  INVENTORY_UPDATED: 'inventory_updated',
  STOCK_ALERT: 'stock_alert',
  
  // Shipment events
  LOAD_CREATED: 'load_created',
  SHIPMENT_DISPATCHED: 'shipment_dispatched',
  
  // Status changes
  STATUS_CHANGED: 'status_changed',
  BATCH_CLOSED: 'batch_closed'
};

// Event category constants
export const TRACEABILITY_CATEGORIES = {
  INTAKE: 'intake',
  CUTTING: 'cutting',
  PRODUCTION: 'production',
  MATERIALS: 'materials',
  INVENTORY: 'inventory',
  SHIPMENT: 'shipment',
  QUALITY: 'quality',
  STATUS: 'status'
};
