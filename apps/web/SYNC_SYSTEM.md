# 🔄 SISTEMA DE SINCRONIZACIÓN CENTRALIZADO - Tecavo Fruits Soft

## Visión General

El sistema de sincronización garantiza que **todos los módulos compartan la misma fuente de verdad**. Cuando actualizas un lote, material, calibre o cualquier otra entidad en un módulo, se actualiza automáticamente en todos los lugares donde se usa.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Inventory    │  │ Loads        │  │ Expenses     │ ...   │
│  │ Module       │  │ Module       │  │ Module       │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                 │
│                      useSync Hook                            │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                        API Call
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                      /api/sync                               │
│                            │                                 │
│              ┌─────────────┴─────────────┐                   │
│              │                           │                   │
│         Route Handler          sync_audit_log                │
│         ┌─────────────┐        (Historial)                   │
│         │ Actualiza:  │                                      │
│         │ - Lotes     │                                      │
│         │ - Materiales│                                      │
│         │ - Calibres  │                                      │
│         │ - Almacén   │                                      │
│         │ - Gastos    │                                      │
│         └─────────────┘                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                      DATABASE (PostgreSQL)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ lots         │  │ materials_   │  │ caliber_     │       │
│  │              │  │ inventory    │  │ definitions  │ ...   │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  Todas las tablas RELACIONADAS se actualizan en cascada    │
└──────────────────────────────────────────────────────────────┘
```

---

## Flujo de Sincronización

### Ejemplo: Cambiar estado de un lote de "selection" a "cutting"

```
1. Usuario edita lote en módulo Inventory
   └─> setLotStatus('123', { status: 'cutting' })

2. Frontend llama a useSync Hook
   └─> syncLot(123, { status: 'cutting' }, ['status'])

3. Hook hace POST a /api/sync
   └─> {
         action: 'update_lot',
         entityType: 'lot',
         entityId: 123,
         data: { status: 'cutting' },
         changedFields: ['status']
       }

4. API /api/sync procesa:
   a) Actualiza tabla 'lots'
   b) Detecta que cambió 'status'
   c) Busca referencias en cascada:
      - Actualiza cutting_orders (si existe)
      - Actualiza lotification_registry (si existe)
      - Notifica otros módulos vía BroadcastChannel
   d) Registra cambio en sync_audit_log

5. BroadcastChannel notifica otros tabs/ventanas
   └─> Todos los componentes que usan este lote se re-renderizarn

6. Usuario ve cambio reflejado en TODOS los módulos instantáneamente
```

---

## Cómo Usar el Sistema

### 1️⃣ En Componentes de React

```javascript
import { useSync } from '@/hooks/useSync';

export default function MyComponent() {
  const { syncLot, syncMaterial, syncCalber } = useSync();

  const handleUpdateLot = async (lotId, newData) => {
    try {
      // Sincronizar cambios en lote
      const result = await syncLot(
        lotId,
        { 
          producer: 'Nuevo Productor',
          status: 'cutting'
        },
        ['producer', 'status']  // Qué campos cambiaron
      );
      
      console.log('✅ Lote sincronizado en todos los módulos:', result);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  return (
    <button onClick={() => handleUpdateLot(123, { status: 'cutting' })}>
      Cambiar Lote a Corte
    </button>
  );
}
```

### 2️⃣ Sincronizar Materiales

```javascript
const { syncMaterial } = useSync();

const handleMaterialDeduction = async (materialId, quantityUsed) => {
  await syncMaterial(
    materialId,
    {
      quantity_available: currentQuantity - quantityUsed,
    },
    ['quantity_available']
  );
  // El inventario de materiales se actualiza automáticamente en Inventory
};
```

### 3️⃣ Sincronizar Calibres

```javascript
const { syncCalber } = useSync();

const handleCaliber = async (caliberId, isActive) => {
  await syncCalber(
    caliberId,
    { is_active: isActive },
    ['is_active']
  );
  // Todos los módulos que usan este calibre se actualizan
};
```

### 4️⃣ Sincronizar Posiciones de Almacén

```javascript
const { syncWarehouseSlot } = useSync();

const handleSlotUpdate = async (slotId, slotData) => {
  await syncWarehouseSlot(slotId, {
    lot_id: slotData.lot_id,
    caliber: slotData.caliber,
    boxes: slotData.boxes,
    quality: slotData.quality
  });
  // Se actualiza en Inventory Y en Loads automáticamente
};
```

### 5️⃣ Sincronizar Gastos (con consumo de materiales)

```javascript
const { syncExpense } = useSync();

const handleExpenseWithMaterial = async (expenseId, materialId, quantity) => {
  await syncExpense(
    expenseId,
    {
      material_id: materialId,
      quantity_used: quantity
    },
    ['quantity_used']
  );
  // Se resta automáticamente del inventario de materiales
};
```

---

## Entidades Sincronizadas

### 1. LOTES (lots)
**Afecta a:**
- Cutting Orders (órdenes de corte)
- Lotification Registry (registro general)
- Production Batches (lotes de producción)
- Sales of Process & Waste (ventas)
- Inventory Barcodes (códigos de barras)
- Public Lot Links (enlaces públicos)
- Weighings (pesajes)
- Broker Payments (pagos a corredores)

**Ejemplo:**
```javascript
syncLot(lotId, { status: 'cutting', producer: 'El Rosal' }, ['status', 'producer'])
```

---

### 2. MATERIALES (materials_inventory)
**Afecta a:**
- Expenses (gastos - cuando se usa material)
- Material Deductions (deducciones en producción)
- Inventory Summary (resumen de inventario)

**Ejemplo:**
```javascript
syncMaterial(materialId, { quantity_available: 150 }, ['quantity_available'])
```

---

### 3. CALIBRES (caliber_definitions)
**Afecta a:**
- Lot Selection Results (resultados de selección)
- Production Selection Details (detalles de selección)
- Pallet Output Summary (resumen de pallets)
- Inventory (inventario)
- Loads (cargas)

**Ejemplo:**
```javascript
syncCalber(caliberId, { is_active: true }, ['is_active'])
```

---

### 4. POSICIONES DE ALMACÉN (warehouse_slots)
**Afecta a:**
- Inventory Module (mapa de almacén)
- Loads Module (mapa de almacén de cargas)

**Ejemplo:**
```javascript
syncWarehouseSlot('A-1', { lot_id: 123, caliber: "Super (40's)", boxes: 180 })
```

---

### 5. GASTOS (expenses)
**Afecta a:**
- Materials Inventory (cuando es consumo de material)
- Cash Management (reportes de gastos)

**Ejemplo:**
```javascript
syncExpense(expenseId, { total: 1500, department: 'Transporte' }, ['total'])
```

---

### 6. VENTAS DE PROCESO/DESECHO (sales_of_process_and_waste)
**Afecta a:**
- Cash Management (cobros pendientes)
- Broker Payments (si se debe pagar a corredores)

**Ejemplo:**
```javascript
syncSaleWaste(saleId, { payment_status: 'pagado' }, ['payment_status'])
```

---

## Consultar Referencias de una Entidad

Para saber **dónde se está usando** una entidad y verificar que se sincronizó correctamente:

```javascript
// GET /api/sync/entity-references?type=lot&id=123
const response = await fetch('/api/sync/entity-references?type=lot&id=123');
const references = await response.json();

console.log(references);
// Output:
// {
//   entityType: 'lot',
//   entityId: 123,
//   references: {
//     cutting_orders: { module: 'Cutting Orders', count: 1, data: [...] },
//     production_batches: { module: 'Production', count: 2, data: [...] },
//     sales: { module: 'Sales (Proceso & Desecho)', count: 5, data: [...] },
//     ...
//   },
//   totalReferences: 8,
//   recentChanges: [...],
//   lastModified: '2024-01-15T10:30:00Z'
// }
```

---

## Auditoría y Historial

Todos los cambios se registran en `sync_audit_log`:

```sql
-- Ver últimos cambios de un lote
SELECT * FROM sync_audit_log 
WHERE entity_type = 'lot' AND entity_id = 123
ORDER BY created_at DESC;

-- Ver cambios por módulo
SELECT * FROM sync_audit_log 
WHERE module_name = 'inventory'
ORDER BY created_at DESC;

-- Ver cambios de una semana
SELECT * FROM sync_audit_log 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Consideraciones Importantes

### ✅ Ventajas
- **Consistencia**: Todos los módulos siempre ven la misma información
- **Automatización**: No hay que actualizar manualmente en múltiples lugares
- **Auditoría**: Historial completo de quién cambió qué y cuándo
- **Escalabilidad**: Fácil agregar nuevas relaciones

### ⚠️ Precauciones
1. **Validación**: Valida datos ANTES de llamar a sync
2. **Transacciones**: Para cambios críticos, usa transacciones SQL
3. **Permisos**: Verifica que el usuario tenga permisos para cada módulo
4. **Cascada**: Un cambio en lote puede afectar muchas entidades

### 🔐 Seguridad
- Los cambios se registran con user_id (si está disponible)
- Se pueden hacer auditorías de cambios por usuario
- Se pueden revertir cambios accidentales buscando en el historial

---

## Ejemplos de Sincronización en Cascada

### Ejemplo 1: Cambiar estado de lote de "selection" → "cutting"
```
Lote #123 cambio estado a "cutting"
  ├─> Actualizar cutting_orders (status = "En Espera")
  ├─> Crear/Actualizar lotification_registry
  ├─> Notificar Inventory Module
  ├─> Notificar Cutting Orders Module
  ├─> Registrar en sync_audit_log
  └─> Broadcast a otros tabs del navegador
```

### Ejemplo 2: Usar material en un gasto
```
Registrar gasto de $500 de "Cajas Master 10kg" (material_id: 45)
  ├─> Crear expense record
  ├─> Restar cantidad del inventory de materiales
  ├─> Actualizar dashboard de gastos
  ├─> Actualizar inventory summary
  ├─> Notificar Inventory Module
  ├─> Registrar en sync_audit_log
  └─> Broadcast a otros tabs del navegador
```

### Ejemplo 3: Actualizar posición de almacén en Cargas
```
Usuario coloca Lote #123 en posición A-1 del módulo Cargas
  ├─> Actualizar warehouse_inventory (slot A-1)
  ├─> Notificar a Inventory Module (actualiza su mapa)
  ├─> Crear barcode inventory record
  ├─> Actualizar tracking/trazabilidad
  ├─> Registrar en sync_audit_log
  └─> Broadcast a otros tabs del navegador
```

---

## Próximas Mejoras

1. **WebSocket en tiempo real**: En lugar de localStorage/BroadcastChannel
2. **Conflict resolution**: Si dos usuarios editan lo mismo simultáneamente
3. **Offline sync**: Sincronización cuando se recupera conectividad
4. **Analytics**: Dashboard de sincronización y resolución de conflictos
5. **API webhooks**: Notificar a sistemas externos cuando hay cambios críticos

---

## Troubleshooting

### ❌ Cambio no se refleja en otro módulo
1. Verifica que estés usando `useSync` hook
2. Verifica que `/api/sync` está respondiendo
3. Abre consola del navegador y busca errores
4. Revisa `sync_audit_log` para ver si el cambio fue registrado

### ❌ Lotes aparecen duplicados
1. Verifica que no hay duplicados en `lots` table
2. Revisa si hay referencia FK rota
3. Ejecuta: `SELECT * FROM lots WHERE lot_number = 'ABC123'`

### ❌ Material no se deduce del inventario
1. Asegúrate de que `syncExpense` se llamó con `material_id`
2. Verifica que el material existe en `materials_inventory`
3. Revisa logs de `/api/sync` en servidor

---

## Resumen

El **Sistema de Sincronización Centralizado** asegura que:
- ✅ Todos los módulos trabajan con la **misma fuente de verdad**
- ✅ Los cambios en un módulo se **propagan automáticamente** a otros
- ✅ Hay **auditoría completa** de todos los cambios
- ✅ El sistema es **escalable** y **mantenible**
- ✅ **No hay inconsistencias** de datos entre módulos

