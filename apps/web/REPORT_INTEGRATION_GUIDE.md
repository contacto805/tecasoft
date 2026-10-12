# Guía de Integración de Reportes - Tecavo Soft

## 📋 Resumen
Sistema unificado de generación de reportes PDF/JPG para todos los módulos de Tecavo Soft.

---

## 🎯 Componentes Principales

### 1. **DownloadReportButton** - Botón de descarga universal
Ubicación: `/components/download-report-button.jsx`

### 2. **report-generator.js** - Utilidad de generación
Ubicación: `/lib/report-generator.js`

### 3. **API Routes**
- `/api/reports/generate` - Registro de reportes generados
- `/api/reports/weekly-summary` - Reportes semanales automáticos

---

## 🚀 Cómo Agregar Reportes a un Módulo

### Paso 1: Importar el componente
```javascript
import DownloadReportButton from '@/components/download-report-button';
```

### Paso 2: Definir las columnas del reporte
```javascript
const reportColumns = [
  { header: 'ID', key: 'id' },
  { header: 'Nombre', key: 'name' },
  { header: 'Fecha', key: 'date', format: (val) => new Date(val).toLocaleDateString('es-MX') },
  { header: 'Monto', key: 'amount', format: (val) => `$${parseFloat(val).toFixed(2)}` }
];
```

### Paso 3: Agregar el botón al módulo
```javascript
<DownloadReportButton
  moduleName="Nombre del Módulo"
  title="Título del Reporte"
  data={tusDatos} // Array de objetos
  columns={reportColumns}
  format="pdf" // "pdf" o "jpg"
  orientation="landscape" // "portrait" o "landscape"
  includeStats={true}
  stats={{
    'Total de Registros': tusDatos.length,
    'Otra Métrica': valor
  }}
/>
```

---

## 📦 Ejemplos por Módulo

### Ejemplo 1: Órdenes de Compra (ya implementado)
```javascript
<DownloadReportButton
  moduleName="Órdenes de Compra"
  title="Reporte de Órdenes de Compra"
  data={filteredRequests}
  columns={[
    { header: 'Folio', key: 'folio' },
    { header: 'Fecha', key: 'request_date', format: (val) => new Date(val).toLocaleDateString('es-MX') },
    { header: 'Área', key: 'area_name' },
    { header: 'Producto/Servicio', key: 'product_or_service' },
    { header: 'Solicitante', key: 'user_name' },
    { header: 'Prioridad', key: 'priority' },
    { header: 'Estatus', key: 'status' }
  ]}
  format="pdf"
  orientation="landscape"
  includeStats={true}
  stats={{
    'Total de Solicitudes': filteredRequests.length,
    'Autorizadas': dashboard?.authorized || 0,
    'Pendientes': dashboard?.pending || 0
  }}
/>
```

### Ejemplo 2: Lotes (para implementar)
```javascript
<DownloadReportButton
  moduleName="Lotes"
  title="Reporte de Lotes"
  data={lots}
  columns={[
    { header: 'Lote', key: 'lot_number' },
    { header: 'Productor', key: 'producer' },
    { header: 'Fecha', key: 'date', format: (val) => new Date(val).toLocaleDateString('es-MX') },
    { header: 'Tipo Fruta', key: 'fruit_type' },
    { header: 'Kg Recibidos', key: 'total_kg_received', format: (val) => `${parseFloat(val).toFixed(2)} kg` },
    { header: 'Estatus', key: 'status' }
  ]}
  format="pdf"
  orientation="landscape"
  includeStats={true}
  stats={{
    'Total de Lotes': lots.length,
    'Kg Totales': lots.reduce((sum, l) => sum + parseFloat(l.total_kg_received || 0), 0).toFixed(2)
  }}
/>
```

### Ejemplo 3: Inventario (para implementar)
```javascript
<DownloadReportButton
  moduleName="Inventario"
  title="Reporte de Inventario"
  data={inventory}
  columns={[
    { header: 'Lote', key: 'lot_id' },
    { header: 'Calibre', key: 'caliber' },
    { header: 'Clase', key: 'class_name' },
    { header: 'Kg Disponibles', key: 'total_kg', format: (val) => `${parseFloat(val).toFixed(2)} kg` },
    { header: 'Fecha', key: 'creation_date', format: (val) => new Date(val).toLocaleDateString('es-MX') }
  ]}
  format="pdf"
  orientation="landscape"
/>
```

### Ejemplo 4: Control de Cajas (para implementar)
```javascript
<DownloadReportButton
  moduleName="Control de Cajas"
  title="Reporte de Control de Cajas"
  data={boxes}
  columns={[
    { header: 'Folio', key: 'folio' },
    { header: 'Chofer', key: 'driver_name' },
    { header: 'Cajas Salida', key: 'boxes_out' },
    { header: 'Cajas Retornadas', key: 'boxes_returned' },
    { header: 'Cajas Faltantes', key: 'missing_boxes' },
    { header: 'Fecha Salida', key: 'date_out', format: (val) => new Date(val).toLocaleDateString('es-MX') },
    { header: 'Estatus', key: 'status' }
  ]}
  format="pdf"
  orientation="landscape"
  includeStats={true}
  stats={{
    'Total de Folios': boxes.length,
    'Cajas Salida': boxes.reduce((sum, b) => sum + (b.boxes_out || 0), 0),
    'Cajas Faltantes': boxes.reduce((sum, b) => sum + (b.missing_boxes || 0), 0)
  }}
/>
```

### Ejemplo 5: Cargas (para implementar)
```javascript
<DownloadReportButton
  moduleName="Cargas"
  title="Reporte de Cargas"
  data={loads}
  columns={[
    { header: 'Fecha', key: 'load_date', format: (val) => new Date(val).toLocaleDateString('es-MX') },
    { header: 'Cliente', key: 'customer_name' },
    { header: 'Destino', key: 'destination' },
    { header: 'Calibre', key: 'caliber' },
    { header: 'Tarimas', key: 'pallets_count' },
    { header: 'Cajas', key: 'boxes_count' },
    { header: 'Kg Totales', key: 'total_kg', format: (val) => `${parseFloat(val).toFixed(2)} kg` },
    { header: 'Precio Total', key: 'total_amount', format: (val) => `$${parseFloat(val).toFixed(2)}` }
  ]}
  format="pdf"
  orientation="landscape"
  includeStats={true}
  stats={{
    'Total de Cargas': loads.length,
    'Kg Enviados': loads.reduce((sum, l) => sum + parseFloat(l.total_kg || 0), 0).toFixed(2),
    'Ingresos Totales': `$${loads.reduce((sum, l) => sum + parseFloat(l.total_amount || 0), 0).toFixed(2)}`
  }}
/>
```

---

## 🎨 Estilo del Botón

El botón usa el color de acento de Tecavo Soft: `#E8D547` (amarillo)

```css
bg-[#E8D547] text-slate-900 hover:bg-[#ddc635]
```

---

## 📊 Reportes Semanales Automáticos

### Componente: WeeklySummaryReport
Ubicación: `/components/weekly-summary-report.jsx`

**Características:**
- Auto-generación cada lunes a las 8:00 AM
- Métricas de todos los módulos
- Histórico de reportes semanales
- Activación/desactivación manual

**Uso:**
```javascript
import WeeklySummaryReport from '@/components/weekly-summary-report';

// En el componente:
<WeeklySummaryReport />
```

**Implementado en:**
- ✅ Dashboard de Administración (`/administracion`)

---

## 🗄️ Tablas de Base de Datos

### module_reports
Registra todos los reportes generados por módulo.

### weekly_summary_reports
Almacena los reportes semanales automáticos con métricas agregadas.

---

## ✅ Checklist de Integración

Para cada módulo, completar:

- [ ] Importar `DownloadReportButton`
- [ ] Definir las columnas del reporte
- [ ] Agregar el botón en la UI (típicamente junto a "Nueva Solicitud" o similar)
- [ ] Definir estadísticas relevantes (opcional)
- [ ] Probar generación PDF
- [ ] Verificar que los datos se formateen correctamente

---

## 🔧 Personalización

### Formato de Columnas
Usa el campo `format` para transformar valores:

```javascript
{ 
  header: 'Fecha', 
  key: 'created_at', 
  format: (val) => new Date(val).toLocaleDateString('es-MX') 
}
```

### Orientación del PDF
- `portrait` - Vertical (por defecto)
- `landscape` - Horizontal (recomendado para tablas anchas)

### Formato de Archivo
- `pdf` - Documento PDF (por defecto)
- `jpg` - Imagen JPG (requiere `elementId`)

---

## 📅 Próximos Pasos

Módulos pendientes de integración:
1. Lotes (`/lotes`)
2. Inventario (`/inventario`)
3. Control de Cajas (`/cajas`)
4. Órdenes de Corte (`/ordenes-corte`)
5. Lotificación (`/lotificacion`)
6. Registro de Lotificación (`/lotificacion-registro`)
7. Cargas (`/cargas`)
8. Ventas Proceso/Desecho (`/ventas-proceso`)
9. Costos Operativos (`/costos-operativos`)
10. Calendario de Pagos (`/calendario-pagos`)

---

## 🐛 Solución de Problemas

### El botón no aparece
- Verificar que `data` sea un array válido
- Verificar que `columns` esté definido correctamente

### El PDF está vacío
- Asegurar que `data` contenga registros
- Verificar que las `keys` de las columnas coincidan con las propiedades del objeto

### Error al generar
- Revisar la consola del navegador
- Verificar que jsPDF y html2canvas estén instalados

---

## 📝 Notas Importantes

1. **Consistencia de Color**: Todos los botones usan `#E8D547` (amarillo de acento Tecavo)
2. **Logging Automático**: Cada descarga se registra en `module_reports`
3. **Performance**: Para conjuntos de datos grandes (+1000 registros), considerar paginación
4. **Seguridad**: Los reportes usan los mismos permisos que el módulo donde se generan

---

## 📞 Soporte

Para problemas o dudas sobre la integración de reportes, contactar al equipo de desarrollo.
