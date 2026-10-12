# 🎨 Marca de Agua y Configuración de Marca - Tecavo Soft

## 📋 Descripción General

Se ha integrado un sistema completo de **Marca de Agua (Watermark)** y **Configuración de Branding** en el panel de administración de Tecavo Soft, permitiendo al super administrador personalizar completamente la apariencia del dashboard con el logotipo y colores corporativos de la empresa.

## ✨ Características Principales

### 1. **Subida de Logo**
- **Ubicación**: Configuración del Sistema → Marca y Marca de Agua
- **Formatos soportados**: JPG, PNG, SVG, WEBP
- **Tamaño máximo**: 5 MB
- **Recomendación**: Usar PNG o SVG con transparencia para mejor visualización
- **Almacenamiento**: Archivos subidos se guardan en `/public/uploads/logos/`

### 2. **Configuración de Marca de Agua**
- **Habilitar/Deshabilitar**: Toggle para mostrar/ocultar la marca de agua
- **Opacidad**: Control deslizante de 5% a 50% para ajustar transparencia
- **Posición**: 9 opciones de posicionamiento en el dashboard:
  - Arriba a la Izquierda
  - Arriba al Centro
  - Arriba a la Derecha
  - Centro Izquierda
  - Centro (posición por defecto)
  - Centro Derecha
  - Abajo a la Izquierda
  - Abajo al Centro
  - Abajo a la Derecha

### 3. **Colores Corporativos**
Gestión centralizada de 4 colores principales:
- **Color de Fondo**: Fondo del dashboard
- **Color Primario**: Botones y elementos principales (#0E4A22 por defecto)
- **Color Secundario**: Elementos secundarios (#963821 por defecto)
- **Color de Acento**: Badges y acentos (#E0DA62 por defecto)

## 🔧 Estructura Técnica

### Archivos Creados

#### API Routes
1. **`/app/api/branding/route.js`**
   - `GET`: Obtiene la configuración de marca actual
   - `POST`: Guarda la configuración de marca y colores

2. **`/app/api/branding/upload-logo/route.js`**
   - `POST`: Carga el archivo de logo
   - Validación de tipo MIME
   - Validación de tamaño
   - Generación de URL pública

#### Componentes Frontend
1. **`/app/settings/page.jsx`** (Modificado)
   - Nuevo tab: "Marca y Marca de Agua"
   - Componente `BrandingSettings`
   - Interfaz de subida de logo
   - Vista previa de logo
   - Controles de marca de agua
   - Configuración de colores

2. **`/app/page.jsx`** (Modificado - Dashboard)
   - Integración del hook `useBranding`
   - Renderizado de marca de agua como fondo
   - Función de alineación `getWatermarkAlignment`
   - Z-index management para capas

#### Hooks
1. **`/hooks/useBranding.js`**
   - Hook personalizado para obtener configuración de marca
   - Manejo de estado de carga
   - Caché de datos

### Base de Datos

#### Tabla: `color_schemes` (Modificada)
```sql
INSERT INTO color_schemes (
  module_name,
  background_color,
  primary_color,
  secondary_color,
  accent_color
)
VALUES (
  'branding',
  '#ffffff',
  '#0E4A22',
  '#963821',
  '#E0DA62'
)
```

#### Tabla: `system_settings` (Existente)
Se añaden nuevas claves:
- `watermark_enabled`: 'true' | 'false'
- `watermark_opacity`: '5' - '50'
- `watermark_position`: 'center' | 'top-left' | etc.
- `logo_url`: URL del logo cargado

## 🎯 Flujo de Uso

### Para el Super Administrador

1. **Acceder a Configuración**
   - Clic en avatar (esquina inferior izquierda)
   - Seleccionar "Configuración del Sistema"
   - Ir a la pestaña "Marca y Marca de Agua"

2. **Subir Logo**
   - Área de drag-and-drop o clic para seleccionar archivo
   - Vista previa inmediata del logo
   - Confirmación de carga exitosa

3. **Configurar Marca de Agua**
   - Habilitar con toggle
   - Ajustar opacidad (5-50%)
   - Seleccionar posición preferida

4. **Personalizar Colores**
   - Usar color picker o ingresar código HEX
   - Vista previa en tiempo real
   - Guardar configuración

5. **Aplicar Cambios**
   - Botón "Guardar Configuración"
   - Recarga automática del dashboard
   - Marca de agua visible inmediatamente

### Para Otros Usuarios

- La marca de agua y colores se aplican automáticamente
- No requiere configuración adicional
- Se carga al abrir el dashboard

## 🎨 Ejemplo de Uso

### Escenario 1: Marca de Agua Centrada
```javascript
{
  watermark_enabled: true,
  watermark_opacity: 20,
  watermark_position: 'center',
  logo_url: '/uploads/logos/logo-1234567890.png'
}
```

### Escenario 2: Logo en Esquina Inferior Derecha
```javascript
{
  watermark_enabled: true,
  watermark_opacity: 15,
  watermark_position: 'bottom-right',
  logo_url: '/uploads/logos/logo-1234567890.svg'
}
```

## 🔒 Seguridad y Validación

### Validaciones en Subida de Logo
- ✅ Solo administrador puede acceder
- ✅ Validación de tipo MIME (image/*)
- ✅ Límite de tamaño (5 MB)
- ✅ Validación de extensión
- ✅ Generación de nombre único con timestamp
- ✅ Almacenamiento seguro en `/public/uploads/logos/`

### Control de Acceso
- Solo Super Administrador puede:
  - Subir logos
  - Configurar marca de agua
  - Cambiar colores corporativos
- Otros usuarios ven los cambios automáticamente

## 📊 Rendimiento

### Optimizaciones
- Logo se carga una sola vez via hook `useBranding`
- Uso de React.memo para evitar re-renders innecesarios
- CSS custom properties para colores
- Opacity CSS nativo para rendimiento

### Caching
- Datos de marca se cachean en el hook
- Se actualiza solo cuando se guarda nueva configuración
- Cambios reflejados sin necesidad de recarga manual

## 🐛 Troubleshooting

### Logo no se muestra
- Verificar que está habilitada la marca de agua (toggle ON)
- Revisar que el logo se cargó correctamente
- Limpiar caché del navegador

### Marca de agua detrás del contenido
- Verificar z-index en CSS
- Aumentar opacidad si es muy transparente
- Cambiar posición si obstruye contenido importante

### Colores no se aplican
- Guardar configuración explícitamente
- Recargar página después de guardar
- Verificar en inspector que CSS variables se actualicen

## 📝 Notas Técnicas

### Z-Index Hierarchy
```
Fixed Elements (Header): z-50
Watermark Background: z-0
Main Content: z-10
Modals/Popups: z-50+
```

### Función de Alineación
```javascript
function getWatermarkAlignment(position) {
  // Mapea 9 posiciones a flexbox properties
  // Soporta: top-*, center-*, bottom-*
  // Con variantes: left, center, right
}
```

### Hook useBranding
```javascript
const { branding, loading } = useBranding();
// branding = { ... configuration }
// loading = boolean (mientras se carga)
```

## 🚀 Futuras Mejoras Posibles

- [ ] Múltiples marcas de agua por horario
- [ ] Rotación de logo
- [ ] Marca de agua por módulo
- [ ] Historial de cambios de branding
- [ ] Preview en tiempo real de marca de agua
- [ ] Exportar/Importar configuración de marca
- [ ] Temas preestablecidos

## 📞 Soporte

Para reportar errores o sugerencias sobre la marca de agua:
1. Acceder a Configuración del Sistema
2. Clic en avatar → "Contáctanos"
3. Detallar el problema o sugerencia
