# ESTRUCTURA COMPLETA DEL SISTEMA - TECAVO FRUITS SOFT

## MÓDULOS PRINCIPALES Y TRAZABILIDAD

### 1. MÓDULO DE PRECIOS (HISTÓRICO SEMANAL)
**Ruta:** `/historico-precios`
**Base de Datos:** `weekly_price_history`, `weekly_prices_by_gramaje`, `weekly_prices_banda`

**Función:** Registro obligatorio de precios semanales (lunes/martes)
**Conecta con:**
- Órdenes de Corte (precio autorizado)
- Lotes (snapshot de precio aplicado)
- Pagos a Productores (calendario de vencimientos)

**Flujo de Datos:**
```
Precio Semanal Capturado → Orden de Corte Generada → Precio aplicado al Lote
```

---

### 2. MÓDULO DE ÓRDENES DE CORTE
**Ruta:** `/cutting-orders`
**Base de Datos:** `cutting_orders`

**Función:** Solicitud de corte en huerta
**Conecta con:**
- Histórico de Precios (precio vigente)
- Lotes (genera lote al recibir fruta)
- Control de Cajas (cajas enviadas)
- Cuadrilla (asignación de personal)
- Brokers (comisiones)

**Flujo de Datos:**
```
Orden de Corte → Pesaje → Lote Creado
Orden de Corte → Cajas Enviadas → Control de Cajas
Orden de Corte → Cuadrilla Asignada → Cierre Semanal
```

---

### 3. MÓDULO DE LOTES
**Ruta:** `/lots`
**Base de Datos:** `lots`

**Función:** Registro central de cada lote de fruta
**Conecta con:**
- Pesajes (kilos recibidos)
- Órdenes de Corte (origen)
- Lotificación (empaque)
- Rendimiento (análisis)
- Inventario (stock disponible)
- Costos (costeo por lote)
- Precios (snapshot histórico)
- Trazabilidad Completa

**Flujo de Datos:**
```
Lote → Pesajes → Lotificación → Inventario → Carga → Venta
         ↓           ↓            ↓           ↓
     Costos    Rendimiento   Materiales   Factura
```

---

### 4. MÓDULO DE PESAJES
**Ruta:** `/fruit-input`
**Base de Datos:** `weighings`, `fruit_input_weighings`

**Función:** Registro de peso de fruta entrante
**Conecta con:**
- Lotes (actualiza kg recibidos)
- Básculas (integración física)

---

### 5. MÓDULO DE CONTROL DE CAJAS
**Ruta:** `/box-control`
**Base de Datos:** `box_control`

**Función:** Control de cajas de campo salidas/retornadas
**Conecta con:**
- Órdenes de Corte (cajas por orden)
- Inventario de Materiales

---

### 6. MÓDULO DE CUADRILLA
**Ruta:** `/crew-management`
**Base de Datos:** `crew_weekly_closings`, `crew_freights`

**Función:** Pagos y cierres de cuadrilla
**Conecta con:**
- Órdenes de Corte (trabajo realizado)
- Cierre Semanal (totales)

---

### 7. MÓDULO DE LOTIFICACIÓN
**Ruta:** `/lot-registration`
**Base de Datos:** `lotification_records`, `lotification_registry`

**Función:** Empaque y clasificación por calibre/calidad
**Conecta con:**
- Lotes (origen)
- Producción (proceso)
- Inventario (resultado)
- Etiquetas (impresión)

**Flujo de Datos:**
```
Lote → Lotificación → Clasificación por Calibre → Inventario en Frío
                   → Proceso/Merma → Venta de Desecho
```

---

### 8. MÓDULO DE RENDIMIENTO
**Ruta:** `/lot-performance`
**Base de Datos:** `lot_performance`, `lot_performance_audit`

**Función:** Análisis de rendimiento por lote
**Conecta con:**
- Lotes (datos base)
- Lotificación (resultados)

---

### 9. MÓDULO DE INVENTARIO
**Ruta:** `/inventory`
**Base de Datos:** `lot_inventory`, `materials_inventory`, `lot_process_inventory`

**Función:** Stock de fruta empacada y materiales
**Conecta con:**
- Lotes (fruta disponible)
- Lotificación (entrada)
- Cargas (salida)
- Materiales (cajas, etiquetas, etc)

**Flujo de Datos:**
```
Lotificación → Inventario Frío → Carga → Venta
Compra Materiales → Inventario Materiales → Producción → Costos
```

---

### 10. MÓDULO DE PRODUCCIÓN
**Ruta:** `/production`
**Base de Datos:** `production_batches`, `production_selection_details`

**Función:** Proceso de empaque
**Conecta con:**
- Lotificación (entrada)
- Materiales (consumo)
- Costos (material usado)

---

### 11. MÓDULO DE MATERIALES
**Ruta:** `/materials-inventory`
**Base de Datos:** `materials_inventory`, `material_deductions`, `material_alerts`

**Función:** Control de cajas, etiquetas, esquineros, tarimas
**Conecta con:**
- Inventario General
- Producción (consumo)
- Costos (costo por material)
- Alertas (stock mínimo)

---

### 12. MÓDULO DE CARGAS
**Ruta:** `/loads`
**Base de Datos:** `load_history`, `load_details`, `trailer_load_map`

**Función:** Despacho de producto
**Conecta con:**
- Inventario (origen)
- Clientes (destino)
- Facturas (documento)
- Fletes (pago de transporte)
- Mapa del Trailer (visualización)

**Flujo de Datos:**
```
Inventario → Carga (Drag & Drop) → Trailer Map → Nota de Venta → Factura
                                              → Flete → Pago
```

---

### 13. MÓDULO DE CLIENTES
**Ruta:** `/customers`
**Base de Datos:** `customers`, `customer_accounts`, `customer_trips`

**Función:** Gestión de clientes
**Conecta con:**
- Cargas (ventas)
- Facturas (documentos)
- Cuenta Corriente (saldo)
- Etiquetas Personalizadas

---

### 14. MÓDULO DE FACTURACIÓN
**Ruta:** `/invoices`
**Base de Datos:** `invoices`, `invoice_items`

**Función:** Facturación de ventas
**Conecta con:**
- Cargas (origen)
- Clientes (receptor)

---

### 15. MÓDULO DE FLETES
**Ruta:** `/foreign-freights`
**Base de Datos:** `foreign_freights`

**Función:** Pago de fletes
**Conecta con:**
- Cargas (viaje)
- Gastos (registro contable)

---

### 16. MÓDULO DE COSTOS
**Ruta:** `/admin/lot-cost-summary`
**Base de Datos:** `lot_cost_summary`, `operating_costs`, `cost_distribution_log`

**Función:** Costeo completo por lote
**Conecta con:**
- Lotes (base)
- Materiales (consumo)
- Gastos (operativos)
- Nómina (mano de obra)
- Fletes
- Cuadrilla

**Flujo de Datos:**
```
Todas las transacciones → Costeo por Lote → Utilidad Neta
```

---

### 17. MÓDULO DE GASTOS
**Ruta:** `/expenses`
**Base de Datos:** `expenses`, `expense_records`, `expense_audit_log`

**Función:** Registro de gastos operativos
**Conecta con:**
- Proveedores
- Costos (distribución)
- Cierre Semanal (totales)
- Documentos (comprobantes)
- Firmas Digitales

**Flujo de Datos:**
```
Gasto Registrado → Comprobante Adjunto → Firma Digital → Cierre Semanal
```

---

### 18. MÓDULO DE NÓMINA
**Ruta:** `/nomina`
**Base de Datos:** `payroll_periods`, `payroll_records`, `payroll_expense_link`

**Función:** Pago a empleados
**Conecta con:**
- Empleados
- Costos (mano de obra)
- Cierre Semanal (totales)
- Firmas Digitales (recibos)

**Flujo de Datos:**
```
Período de Nómina → Pago Individual → Firma del Empleado → Cierre Semanal
```

---

### 19. MÓDULO DE EMPLEADOS
**Ruta:** `/admin/users`
**Base de Datos:** `user`, `user_permissions`, `employee_fingerprints`

**Función:** Personal y permisos
**Conecta con:**
- Nómina (pagos)
- Préstamos
- Asistencias (biométrico)
- Permisos por Módulo

---

### 20. MÓDULO DE PRÉSTAMOS
**Ruta:** `/prestamos`
**Base de Datos:** `employee_loans`

**Función:** Préstamos a empleados
**Conecta con:**
- Empleados
- Firmas Digitales

---

### 21. MÓDULO DE ASISTENCIAS
**Ruta:** `/attendance`
**Base de Datos:** `attendance_records`, `biometric_devices`

**Función:** Control de asistencia biométrico
**Conecta con:**
- Empleados
- Dispositivos Biométricos

---

### 22. MÓDULO DE PAGOS A PRODUCTORES
**Ruta:** `/payment-schedule`
**Base de Datos:** `payment_schedule`, `producer_payments`

**Función:** Calendario de pagos a productores
**Conecta con:**
- Lotes (compras)
- Histórico de Precios (precio aplicado)

---

### 23. MÓDULO DE CIERRES SEMANALES
**Ruta:** `/weekly-closings`
**Base de Datos:** `weekly_closings`, `weekly_cost_summary`

**Función:** Cierre contable semanal
**Conecta con:**
- Gastos (egresos)
- Nómina (egresos)
- Cuadrilla (egresos)
- Cargas (ingresos)
- Ventas de Proceso/Merma (ingresos)

**Flujo de Datos:**
```
Todos los Ingresos y Egresos de la Semana → Cierre Semanal → Resultado
```

---

### 24. MÓDULO DE BROKERS
**Ruta:** `/brokers`
**Base de Datos:** `broker_notes`, `broker_payments`

**Función:** Comisionistas y notas
**Conecta con:**
- Órdenes de Corte
- Lotes
- Pagos

---

### 25. MÓDULO DE VENTA DE PROCESO Y MERMA
**Ruta:** `/sales-process-waste`
**Base de Datos:** `sales_of_process_and_waste`

**Función:** Venta de productos derivados
**Conecta con:**
- Lotificación (origen)
- Cierre Semanal (ingresos)

---

### 26. MÓDULO DE CÓDIGOS QR
**Ruta:** `/qr-system`
**Base de Datos:** `qr_codes`, `public_lot_links`, `public_qr_access_log`

**Función:** Trazabilidad QR
**Conecta con:**
- Lotes (vinculación)
- Dashboard Público

---

### 27. MÓDULO DE ETIQUETAS
**Ruta:** `/label-templates`
**Base de Datos:** `label_templates`, `thermal_labels`, `label_print_log`

**Función:** Diseño e impresión de etiquetas
**Conecta con:**
- Clientes (templates personalizados)
- Lotes (datos)
- Impresoras Térmicas

---

### 28. MÓDULO DE REPORTES
**Ruta:** `/reportes-automaticos`
**Base de Datos:** `module_reports`, `report_generation_log`

**Función:** Generación automática de reportes
**Conecta con:**
- Todos los Módulos (datos)

---

### 29. MÓDULO DE BÚSQUEDA GLOBAL
**Ruta:** `/admin/global-search`
**API:** `/api/admin/global-search`

**Función:** Búsqueda transversal en todo el sistema
**Busca en:**
- Lotes
- Clientes
- Cargas
- Gastos
- Empleados
- Facturas
- Órdenes

---

### 30. MÓDULO DE AUDITORÍA
**Ruta:** `/admin/audit-log`
**Base de Datos:** `system_audit_log`, `price_history_audit`, `operating_costs_audit`

**Función:** Registro de cambios
**Conecta con:**
- Todos los Módulos (trazabilidad de cambios)

---

## FLUJOS CRÍTICOS DE TRAZABILIDAD

### FLUJO 1: COMPRA DE FRUTA
```
1. Precio Semanal Capturado (lunes/martes)
2. Orden de Corte Generada (con precio vigente)
3. Fruta Cortada en Huerta
4. Pesaje en Recepción
5. Lote Creado (con snapshot de precio)
6. Pago Programado a Productor
```

### FLUJO 2: PRODUCCIÓN
```
1. Lote Recibido
2. Lotificación (clasificación)
3. Rendimiento Calculado
4. Inventario en Frío Actualizado
5. Materiales Consumidos
6. Costos Calculados
```

### FLUJO 3: VENTA
```
1. Inventario Disponible
2. Carga Creada (Drag & Drop)
3. Trailer Map Diseñado
4. Nota de Venta Generada
5. Factura Emitida
6. Flete Pagado
7. Cliente Cobrado
```

### FLUJO 4: CIERRE FINANCIERO
```
1. Gastos Registrados (con firma)
2. Nómina Pagada (con firma)
3. Cuadrilla Pagada
4. Cargas Facturadas
5. Ventas de Proceso/Merma
6. Cierre Semanal Generado
7. Resultado Calculado
```

---

## BASES DE DATOS PRINCIPALES

### TABLAS CORE
- `lots` - Lotes de fruta
- `cutting_orders` - Órdenes de corte
- `weighings` - Pesajes
- `lotification_records` - Lotificación
- `lot_inventory` - Inventario
- `load_history` - Cargas
- `customers` - Clientes
- `invoices` - Facturas

### TABLAS DE COSTOS
- `lot_cost_summary` - Costeo por lote
- `operating_costs` - Costos operativos
- `cost_distribution_log` - Distribución de costos
- `weekly_cost_summary` - Resumen semanal

### TABLAS DE PRECIOS
- `weekly_price_history` - Semanas de precio
- `weekly_prices_by_gramaje` - Precios por categoría
- `weekly_prices_banda` - Precios a la banda
- `lot_price_snapshot` - Snapshot aplicado al lote

### TABLAS DE PERSONAL
- `user` - Usuarios
- `payroll_records` - Nómina
- `employee_loans` - Préstamos
- `attendance_records` - Asistencias

### TABLAS DE TRAZABILIDAD
- `system_audit_log` - Auditoría general
- `traceability_log` - Trazabilidad de lotes
- `public_qr_access_log` - Accesos QR

---

## NAVEGACIÓN CONTEXTUAL

Cada módulo incluye:
- **TraceabilityNav**: Botones de navegación a módulos relacionados
- **QuickNavPanel**: Acceso rápido flotante
- **Búsqueda Global**: Búsqueda transversal
- **Mapa de Trazabilidad**: Visualización de conexiones

---

## INTEGRACIONES

### Hardware
- Básculas (serial/USB)
- Lectores Biométricos
- Impresoras Térmicas (80mm)
- Lectores QR/Código de Barras

### APIs Externas
- Tipo de Cambio (MXN/USD)
- Geolocalización (coordenadas GPS)

### Documentos
- PDF (reportes, etiquetas)
- Excel (exportaciones)
- Imágenes (comprobantes, firmas)

---

## SEGURIDAD Y PERMISOS

### Roles
- **Superadministrador**: Acceso total
- **Administración**: Consulta y captura
- **Operador**: Módulos específicos
- **Empleado**: Solo lectura

### Auditoría
- Todos los cambios se registran
- IP y usuario capturado
- Bitácora permanente

---

Este sistema está diseñado para mantener trazabilidad completa desde la compra de fruta hasta la venta final, pasando por todos los procesos intermedios y permitiendo navegación fluida entre módulos relacionados.
