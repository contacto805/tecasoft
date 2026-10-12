/**
 * Sistema de Sincronización en Tiempo Real para Tecavo Fruits Soft
 * Gestiona la comunicación automática entre módulos
 */

const SYNC_EVENTS = {
  LOT_CREATED: 'lot_created',
  LOT_UPDATED: 'lot_updated',
  LOTIFICATION_CREATED: 'lotification_created',
  LOTIFICATION_UPDATED: 'lotification_updated',
  REGISTRY_CREATED: 'registry_created',
  REGISTRY_UPDATED: 'registry_updated',
  LOAD_CREATED: 'load_created',
  LOAD_UPDATED: 'load_updated',
  BOX_CONTROL_UPDATED: 'box_control_updated',
  CUTTING_ORDER_CREATED: 'cutting_order_created',
  CUTTING_ORDER_UPDATED: 'cutting_order_updated',
  SELECTION_CREATED: 'selection_created',
  SELECTION_UPDATED: 'selection_updated',
  REFRESH_ALL: 'refresh_all'
};

class SyncManager {
  constructor() {
    this.listeners = new Map();
    this.lastSync = Date.now();
    
    // Escuchar eventos de localStorage (sincronización entre pestañas)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }

  /**
   * Emitir un evento de sincronización
   */
  emit(eventType, data = {}) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      source: 'local'
    };

    // Guardar en localStorage para sincronizar entre pestañas
    if (typeof window !== 'undefined') {
      localStorage.setItem('tecavo_sync_event', JSON.stringify(event));
      // Limpiar después de 100ms
      setTimeout(() => {
        localStorage.removeItem('tecavo_sync_event');
      }, 100);
    }

    // Notificar a listeners locales
    this.notifyListeners(event);
  }

  /**
   * Escuchar eventos de sincronización
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    // Retornar función para remover el listener
    return () => {
      const listeners = this.listeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Manejar eventos del localStorage (otras pestañas)
   */
  handleStorageEvent(e) {
    if (e.key === 'tecavo_sync_event' && e.newValue) {
      try {
        const event = JSON.parse(e.newValue);
        event.source = 'remote';
        this.notifyListeners(event);
      } catch (error) {
        console.error('Error parsing sync event:', error);
      }
    }
  }

  /**
   * Notificar a todos los listeners
   */
  notifyListeners(event) {
    // Listeners específicos del tipo de evento
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(callback => {
      try {
        callback(event.data, event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });

    // Listeners para todos los eventos
    const allListeners = this.listeners.get('*') || [];
    allListeners.forEach(callback => {
      try {
        callback(event.data, event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Limpiar todos los listeners
   */
  clear() {
    this.listeners.clear();
  }
}

// Instancia global del SyncManager
const syncManager = typeof window !== 'undefined' ? new SyncManager() : null;

export { syncManager, SYNC_EVENTS };
