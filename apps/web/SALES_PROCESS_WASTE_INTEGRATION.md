# Módulo de Venta de Proceso y Desecho - Integración Completa

## 📋 Resumen de Integración

Se ha completado la integración del módulo de **Venta de Proceso y Desecho** con las siguientes funcionalidades avanzadas:

### ✅ 1. **Módulo de Pesada Integrado en Tiempo Real**

**Ubicación:** Panel de Pesada en Tiempo Real (parte superior del formulario)

**Características:**
- **Display de Peso Actual:** Muestra el peso detectado por la escala externa en tiempo real (cifra grande y legible)
- **Estadísticas Automáticas:**
  - Peso máximo detectado
  - Peso mínimo detectado
  - Promedio de lecturas
  - Total de lecturas realizadas
- **Historial Visual:** Gráfico SVG que muestra las últimas 20 lecturas como tendencia con:
  - Línea de tendencia del peso
  - Punto actual marcado
  - Auto-escalamiento dinámico según rangos de peso
- **Integración Automática:** Al presionar "Usar peso actual", el campo "Kg Proceso" se rellena automáticamente
- **Estado de Conexión:** Indicador visual que muestra si la escala está conectada

**Cómo funciona:**
1. El hook `useScaleDevice` detecta automáticamente lecturas de la escala
2. Se mantiene un historial de los últimos 20 pesos en `weightReadings`
3. El usuario puede expandir/contraer el panel de pesada según necesidad
4. Cada lectura nueva se agrega automáticamente al historial y gráfico

---

### ✅ 2. **Sistema de Folio Automático y Consecutivo**

**Ubicación:** Campo "Folio de Venta" en la sección "Información de Origen"

**Características:**
- **Folio Automático:** Se genera automáticamente al abrir el formulario
- **Formato:** `VENTA-XXXX` (ej: VENTA-0001, VENTA-0002, VENTA-0003)
- **Irrepetible:** El sistema consulta la última venta registrada y genera el siguiente número automáticamente
- **API Endpoint:** `/api/sales-process-waste/next-folio`
- **Sincronización:** Cada vez que se guarda un registro, se obtiene el siguiente folio

**Implementación técnica:**
```javascript
// Obtener próximo folio
GET /api/sales-process-waste/next-folio
Response: { nextFolio: "VENTA-0045" }

// Se consulta el último folio en base de datos
SELECT sales_folio FROM sales_of_process_and_waste 
WHERE sales_folio LIKE 'VENTA-%'
ORDER BY created_at DESC LIMIT 1
```

---

### ✅ 3. **Integración de Impresoras Térmicas**

**Ubicación:** Sección "Seleccionar Impresora para Ticket" (antes del formulario principal)

**Características:**

#### **Configuración de Impresoras**
- **Ubicación del módulo:** `Impresoras` (en navegación principal)
- **Tipos soportados:**
  - Térmica 80mm (Standard para tickets)
  - Térmica 58mm
  - A4 Láser
  - A4 Inyección
  - Matricial
- **Conexión:**
  - Red (IP + Puerto) - recomendado para impresoras de red
  - USB - para conexión directa
  - Serial - para puertos COM antiguos

#### **Impresión Automática de Tickets**
1. **Al guardar un nuevo registro:**
   - Si hay impresora seleccionada, se imprime automáticamente un ticket
   - El ticket contiene:
     - Folio de venta (código único)
     - Información de origen (Lote, Productor, Fruta)
     - Detalles de venta (Comprador, Destino, Producto)
     - Cantidades (Proceso, Desecho, Merma en kg)
     - Precios unitarios y total
     - Observaciones (si existen)
     - Timestamp de generación

2. **Reimpresión de Tickets:**
   - Botón "Reimprimir Ticket" en cada registro de venta
   - Permite imprimir el ticket nuevamente sin modificar el registro
   - Útil si se perdió el original o la impresora fallo

#### **Formato del Ticket (Térmicas 80mm)**
```
=========================================
          TECAVO SOFT
    Venta de Proceso y Desecho
=========================================

FOLIO: VENTA-0045

Fecha: 28/11/2024
Hora: 14:35:22
-----------------------------------------

INFORMACION DE ORIGEN
-----------------------------------------
Lote: LOT-2024-001
Productor: Juan García
Fruta: Aguacate Hass
Lote Fuente: LOT-2024-001

DETALLES DE VENTA
-----------------------------------------
Comprador: Distribuidor Regional ABC
Destino: CDMX
Producto: Pulpa Congelada

CANTIDADES
-----------------------------------------
Kg Proceso:              125.50 kg
Kg Desecho:               8.75 kg
Kg Merma:                 2.25 kg

PRECIOS
=========================================
Precio Unitario:    $2.50/kg
=========================================
TOTAL A PAGAR:      $313.75
=========================================

OBSERVACIONES
-----------------------------------------
Entrega pactada para viernes próximo

---
    Gracias por su compra

    Sistema TECAVO SOFT
```

#### **API de Impresión**
```javascript
POST /api/sales-process-waste/print-ticket
Body: {
  recordId: 123,           // ID del registro de venta
  printerId: 5            // ID de la impresora (opcional, usa default)
}

Response: {
  success: true,
  message: "Ticket enviado a la impresora",
  ticket: "contenido en texto",
  printer: {
    name: "Impresora Empaque",
    type: "Térmica 80mm",
    connection: "network"
  }
}
```

---

### ✅ 4. **Funcionalidades Complementarias**

#### **Cálculo Automático de Precios**
- Campo "Precio Total Calculado" calcula automáticamente: `Kg Proceso × Precio/Kg`
- Se puede sobrescribir manualmente si es necesario
- Muestra preview de cálculo en tiempo real

#### **Integración con Lotificación**
- Al seleccionar un registro de lotificación, se auto-rellenan:
  - Kg de Desecho (desde `total_kg_waste`)
  - Kg de Merma (desde `total_kg_loss`)
- Vinculación automática del lote origen

#### **Búsqueda y Filtrado Avanzado**
- Buscar por folio de venta, lote o producto
- Filtrar por rango de fechas
- Filtrar por comprador
- Búsqueda en tiempo real mientras se escribe

---

## 🔌 **Estructura de Base de Datos**

```sql
-- Tabla existente (sin cambios requeridos)
CREATE TABLE sales_of_process_and_waste (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  lot_id INTEGER,
  lotification_record_id INTEGER,
  buyer_name TEXT,
  destination TEXT,
  date DATE,
  source_batch_number TEXT,
  sales_folio TEXT,              -- Ej: VENTA-0045
  product_name TEXT,
  process_kg NUMERIC,
  waste_kg NUMERIC,
  shrinkage_kg NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  calculated_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🛠️ **Archivos Creados/Modificados**

### **Nuevos Archivos:**
1. `/app/api/sales-process-waste/next-folio/route.js` - API para generar folios
2. `/app/api/sales-process-waste/print-ticket/route.js` - API para generar tickets
3. `/SALES_PROCESS_WASTE_INTEGRATION.md` - Este archivo

### **Archivos Modificados:**
1. `/app/sales-process-waste/page.jsx` - Integración de pesada, impresoras y folio automático

---

## 🚀 **Cómo Usar el Módulo**

### **Paso 1: Configurar Impresoras**
1. Ve a **Impresoras** en la navegación principal
2. Haz clic en **"Agregar Impresora"**
3. Completa los datos:
   - Nombre (ej: "Impresora Empaque")
   - Tipo (Térmica 80mm recomendado)
   - Conexión (Red o USB/Serial)
   - IP y Puerto (si es red)
   - Puerto del dispositivo (si es USB/Serial)
4. Marca como "Predeterminada" si deseas que se use automáticamente
5. Guarda la configuración

### **Paso 2: Crear Venta de Proceso/Desecho**
1. Ve a **Venta de Proceso y Desecho** en la navegación
2. Haz clic en **"Nuevo Registro"**
3. El folio se genera automáticamente (ej: VENTA-0001)
4. **Si tienes escala conectada:**
   - Expande el panel de pesada en tiempo real
   - Coloca el producto en la escala
   - Visualiza el peso en el display grande
   - Haz clic en "Usar peso actual: XXX kg" para llenar automáticamente
5. Completa los demás campos:
   - Información de origen (Lote, Comprador, Producto)
   - Cantidades (si no usaste la escala)
   - Precio unitario
6. Selecciona la impresora para el ticket
7. Haz clic en **"Crear Registro"**
8. El ticket se imprime automáticamente en la impresora seleccionada

### **Paso 3: Reimprimir Tickets**
1. Ve al registro de venta en la lista
2. Haz clic en **"Reimprimir Ticket"**
3. El ticket se envía nuevamente a la impresora

---

## 📊 **Datos Mostrados en el Sistema**

### **Panel de Pesada (Tiempo Real)**
- Peso actual en kg (display 5xl)
- Máximo, mínimo, promedio y total de lecturas
- Gráfico SVG con historial de últimas 20 lecturas
- Indicador de última lectura con timestamp

### **Listado de Ventas**
Para cada venta se muestra:
- **Folio de venta** (ej: VENTA-0045)
- **Lote fuente**
- **Nombre del producto**
- **Comprador y destino**
- **Fecha de venta**
- **Cantidades:**
  - Kg Proceso (destaca en púrpura)
  - Kg Desecho (rojo)
  - Kg Merma (naranja)
- **Precio total** (destacado en ámbar)
- **Precio unitario**
- **Botones de acción:**
  - Editar
  - Eliminar
  - Reimprimir Ticket

---

## ⚙️ **Configuraciones Opcionales**

### **Sincronización Automática**
El sistema usa el `useSync` hook para mantener actualizados los datos:
- Cambios en lotificación se reflejan automáticamente
- Nuevas ventas aparecen sin recargar la página
- Historial de precios se actualiza en tiempo real

### **Alertas y Validaciones**
- Se solicita confirmación antes de eliminar
- Advertencias si faltan campos obligatorios
- Validación de precios antes de guardar

---

## 📱 **Características Móviles**

El módulo está completamente optimizado para:
- Tablet en operaciones de empaque
- Teléfono (pantalla comprimida pero funcional)
- Impresoras térmicas portátiles USB/Serial para iPad

---

## 🔐 **Seguridad**

- **Folios Únicos:** Garantizados a nivel de BD
- **Trazabilidad Completa:** Cada venta vinculada a lote origen
- **Registro de Cambios:** Timestamps de creación/actualización
- **Permisos:** Integrado con sistema de permisos por módulo

---

## 📞 **Soporte y Troubleshooting**

### **Si la impresora no funciona:**
1. Verifica que la impresora esté en la lista (Módulo Impresoras)
2. Verifica que esté marcada como "Activa"
3. Para red: comprueba IP y puerto
4. Para USB/Serial: verifica el puerto del dispositivo

### **Si el folio no se genera:**
1. Recarga la página
2. Verifica que haya registros previos en BD
3. Contacta soporte técnico

### **Si la pesada no funciona:**
1. Verifica que la escala esté configurada (Configuración > Escala)
2. Comprueba que esté conectada y activa
3. Reinicia el módulo de pesada

---

## 🎯 **Flujo Completo de Ejemplo**

```
1. Lote creado en "Ingreso de Fruta"
   ↓
2. Lote clasificado en "Registro de Lotificación"
   ↓
3. Parte del lote es producto de proceso/desecho
   ↓
4. Usuario abre "Venta de Proceso y Desecho"
   ↓
5. Sistema genera folio automático (VENTA-0045)
   ↓
6. Usuario coloca producto en escala conectada
   ↓
7. Escala muestra peso en tiempo real (125.5 kg)
   ↓
8. Usuario hace clic "Usar peso actual"
   ↓
9. Kg Proceso se rellena automáticamente (125.5)
   ↓
10. Usuario ingresa precio unitario ($2.50/kg)
    ↓
11. Sistema calcula total automático ($313.75)
    ↓
12. Usuario selecciona impresora térmica
    ↓
13. Usuario hace clic "Crear Registro"
    ↓
14. Registro se guarda en BD
    ↓
15. Ticket se imprime automáticamente en impresora 80mm
    ↓
16. Sistema genera nuevo folio (VENTA-0046) para siguiente venta
```

---

**Versión:** 1.0  
**Última actualización:** 2024  
**Estado:** ✅ Implementado y Funcional
