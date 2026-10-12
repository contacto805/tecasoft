# Sistema de Colores Tecavo Soft

## Paleta de Colores Principal

```css
--brand-primary:   #0E4A22  /* Verde oscuro - Principal */
--brand-secondary: #963821  /* Terracota - Secundario */
--brand-accent:    #E0DA62  /* Amarillo dorado - Acento/Bordes */
--brand-text:      #0A3020  /* Verde profundo - Texto */
--brand-border:    #E0DA62  /* Amarillo dorado - Bordes */
```

## Cómo se Aplican los Colores

### 1. Variables CSS Globales
Los colores están definidos en `/app/globals.css` como variables CSS:
```css
:root {
  --brand-primary: #0E4A22;
  --brand-secondary: #963821;
  --brand-accent: #E0DA62;
  --brand-text: #0A3020;
  --brand-border: #E0DA62;
}
```

### 2. Configuración de Tailwind
En `tailwind.config.js`, los colores están mapeados:
```javascript
colors: {
  brand: {
    primary: 'var(--brand-primary)',
    secondary: 'var(--brand-secondary)',
    accent: 'var(--brand-accent)',
    text: 'var(--brand-text)',
    border: 'var(--brand-border)',
  }
}
```

### 3. Uso en Componentes

#### Clases de Tailwind (recomendado):
```jsx
<div className="bg-brand-primary text-white">
<div className="text-brand-text border-brand-accent">
<button className="bg-brand-secondary hover:bg-brand-primary">
```

#### Estilos inline con variables CSS:
```jsx
<div style={{ backgroundColor: 'var(--brand-primary)' }}>
<div style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-border)' }}>
```

#### Hook useColorScheme (para módulos específicos):
```jsx
import { useColorScheme } from '@/hooks/useColorScheme';

function MyComponent() {
  const { colors } = useColorScheme('module-name');
  
  return (
    <div style={{ backgroundColor: colors.primary_color }}>
      <h1 style={{ color: colors.text_color }}>Título</h1>
    </div>
  );
}
```

## Base de Datos

Los colores se almacenan en la tabla `color_schemes`:
- Cada módulo puede tener su propio esquema de colores
- Los colores se cargan dinámicamente al inicio de la aplicación
- Se sincronizan automáticamente cuando se actualizan en Configuración de Colores

## Carga Automática

En `app/layout.jsx`, un script carga los colores al inicio:
```javascript
fetch('/api/color-schemes')
  .then(schemes => {
    document.documentElement.style.setProperty('--brand-primary', scheme.primary_color);
    // ... otros colores
  });
```

## Módulos con Personalización

1. **Dashboard Principal** (`dashboard`)
2. **Ingreso de Fruta** (`fruit-input`)
3. **Inventario** (`inventory`)
4. **Órdenes de Corte** (`cutting-orders`)
5. **Control de Cajas** (`box-control`)
6. **Lotificación** (`lotification`)
7. **Rendimiento de Lote** (`lotification-registry`)
8. **Ventas Proceso/Merma** (`sales-process-waste`)
9. **Módulo de Cargas** (`loads`)
10. **Encabezado/Navegación** (`header`)
11. **Pie de Página** (`footer`)

## Clases de Utilidad Personalizadas

En `globals.css`, hay clases adicionales:
```css
.bg-brand-primary { background-color: var(--brand-primary) !important; }
.bg-brand-secondary { background-color: var(--brand-secondary) !important; }
.bg-brand-accent { background-color: var(--brand-accent) !important; }
.text-brand-primary { color: var(--brand-primary) !important; }
.text-brand-secondary { color: var(--brand-secondary) !important; }
.text-brand-accent { color: var(--brand-accent) !important; }
.text-brand-text { color: var(--brand-text) !important; }
.border-brand-primary { border-color: var(--brand-primary) !important; }
.border-brand-secondary { border-color: var(--brand-secondary) !important; }
.border-brand-accent { border-color: var(--brand-accent) !important; }
.border-brand-border { border-color: var(--brand-border) !important; }
```

## Cambiar Colores del Sistema

1. Ve a **Configuración de Colores** desde el dashboard
2. Selecciona el módulo que deseas personalizar
3. Ajusta los colores usando los selectores de color
4. Haz clic en **Guardar Colores**
5. Los cambios se aplican automáticamente en todo el sistema

## Verificar Colores Actuales

Ejecuta en la consola del navegador:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')
getComputedStyle(document.documentElement).getPropertyValue('--brand-secondary')
getComputedStyle(document.documentElement).getPropertyValue('--brand-accent')
getComputedStyle(document.documentElement).getPropertyValue('--brand-text')
```
