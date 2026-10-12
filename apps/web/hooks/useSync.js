import { useCallback } from 'react';

/**
 * Hook de sincronización para mantener datos sincronizados globalmente
 * Cuando una entidad se actualiza en cualquier módulo, se notifica al sistema
 * y todos los módulos que la usan se actualizan automáticamente
 */
export function useSync() {
  
  /**
   * Sincronizar cambios de lote
   * @param {number} lotId - ID del lote
   * @param {object} data - Datos del lote a actualizar
   * @param {array} changedFields - Qué campos cambiaron
   */
  const syncLot = useCallback(async (lotId, data, changedFields = []) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lot',
          entityType: 'lot',
          entityId: lotId,
          data,
          changedFields
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando lote');
      }

      const result = await response.json();
      console.log('✅ Lote sincronizado:', result);
      
      // Notificar a otros módulos (WebSocket, etc.)
      broadcastSync('lot', lotId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar lote:', error);
      throw error;
    }
  }, []);

  /**
   * Sincronizar cambios de material
   */
  const syncMaterial = useCallback(async (materialId, data, changedFields = []) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_material',
          entityType: 'material',
          entityId: materialId,
          data,
          changedFields
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando material');
      }

      const result = await response.json();
      console.log('✅ Material sincronizado:', result);
      
      broadcastSync('material', materialId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar material:', error);
      throw error;
    }
  }, []);

  /**
   * Sincronizar cambios de calibre
   */
  const syncCalber = useCallback(async (caliberId, data, changedFields = []) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_caliber',
          entityType: 'caliber',
          entityId: caliberId,
          data,
          changedFields
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando calibre');
      }

      const result = await response.json();
      console.log('✅ Calibre sincronizado:', result);
      
      broadcastSync('caliber', caliberId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar calibre:', error);
      throw error;
    }
  }, []);

  /**
   * Sincronizar posición de almacén (afecta inventario y cargas)
   */
  const syncWarehouseSlot = useCallback(async (slotId, data) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_warehouse',
          entityType: 'warehouse_slot',
          entityId: slotId,
          data: { ...data, slot_id: slotId }
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando almacén');
      }

      const result = await response.json();
      console.log('✅ Almacén sincronizado:', result);
      
      broadcastSync('warehouse_slot', slotId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar almacén:', error);
      throw error;
    }
  }, []);

  /**
   * Sincronizar gasto (afecta inventario de materiales)
   */
  const syncExpense = useCallback(async (expenseId, data, changedFields = []) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_expense',
          entityType: 'expense',
          entityId: expenseId,
          data,
          changedFields
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando gasto');
      }

      const result = await response.json();
      console.log('✅ Gasto sincronizado:', result);
      
      broadcastSync('expense', expenseId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar gasto:', error);
      throw error;
    }
  }, []);

  /**
   * Sincronizar venta de proceso/desecho
   */
  const syncSaleWaste = useCallback(async (saleId, data, changedFields = []) => {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_sale_waste',
          entityType: 'sale_waste',
          entityId: saleId,
          data,
          changedFields
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando venta');
      }

      const result = await response.json();
      console.log('✅ Venta sincronizada:', result);
      
      broadcastSync('sale_waste', saleId, data);
      
      return result;
    } catch (error) {
      console.error('Error al sincronizar venta:', error);
      throw error;
    }
  }, []);

  return {
    syncLot,
    syncMaterial,
    syncCalber,
    syncWarehouseSlot,
    syncExpense,
    syncSaleWaste
  };
}

/**
 * Broadcast de cambios a otros tabs/ventanas del navegador
 */
function broadcastSync(entityType, entityId, data) {
  // Usar localStorage para sincronizar entre tabs
  const event = {
    type: 'sync_update',
    entityType,
    entityId,
    data,
    timestamp: Date.now()
  };

  // Guardar en localStorage para que otros tabs lo detecten
  try {
    localStorage.setItem('__sync_update__', JSON.stringify(event));
    localStorage.removeItem('__sync_update__');
  } catch (e) {
    console.warn('No se puede usar localStorage para broadcast');
  }

  // También usar BroadcastChannel si está disponible
  try {
    const channel = new BroadcastChannel('tecavo_sync');
    channel.postMessage(event);
    channel.close();
  } catch (e) {
    // BroadcastChannel no disponible en todos los navegadores
  }
}

/**
 * Hook para escuchar cambios de sincronización en tiempo real
 */
export function useSyncListener(entityType, onSync) {
  React.useEffect(() => {
    // Escuchar cambios de localStorage
    const handleStorageChange = (e) => {
      if (e.key === '__sync_update__' && e.newValue) {
        try {
          const event = JSON.parse(e.newValue);
          if (event.entityType === entityType) {
            onSync(event);
          }
        } catch (error) {
          console.error('Error parsing sync event:', error);
        }
      }
    };

    // Escuchar cambios de BroadcastChannel
    let channel;
    try {
      channel = new BroadcastChannel('tecavo_sync');
      channel.onmessage = (e) => {
        if (e.data.entityType === entityType) {
          onSync(e.data);
        }
      };
    } catch (e) {
      // BroadcastChannel no disponible
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, [entityType, onSync]);
}
