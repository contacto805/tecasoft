# 🎨 Guía Visual: Marca de Agua en Tecavo Soft

## 📍 Dónde Acceder

```
Dashboard Principal
        ↓
    Avatar
  (esquina inferior izquierda)
        ↓
"Configuración del Sistema"
        ↓
Pestaña "Marca y Marca de Agua"
        ↓
¡Configurar marca de agua!
```

## 🖼️ Interfaz de Configuración

```
┌─────────────────────────────────────────────────────────┐
│  CONFIGURACIÓN DEL SISTEMA                         ← X  │
├─────────────────────────────────────────────────────────┤
│ [Usuarios] [Colores] [Escalas] [Marca y Marca de Agua] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📷 Logo de la Empresa                                  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌───────────────────┐    ┌────────────────────────┐   │
│  │  SUBIR ARCHIVO    │    │    VISTA PREVIA       │   │
│  │  (Drag & Drop)    │    │  ┌──────────────────┐ │   │
│  │                   │    │  │                  │ │   │
│  │  📁 JPG, PNG      │    │  │   [Logo Image]   │ │   │
│  │  SVG, WEBP        │    │  │                  │ │   │
│  │  Max 5MB          │    │  └──────────────────┘ │   │
│  │                   │    │   Logo cargado ✅     │   │
│  └───────────────────┘    └────────────────────────┘   │
│                                                         │
│  💧 Configuración de Marca de Agua                      │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ☐ Mostrar Marca de Agua                    [Toggle]   │
│     "Habilita la marca de agua del logo..."            │
│                                                         │
│  Opacidad: 15%                                          │
│  ├─────●─────┤ ← Más transparente | Más visible →      │
│  5%          50%                                        │
│                                                         │
│  Posición de la Marca de Agua:                          │
│  ┌──────────────────────────────────┐                   │
│  │ Centro ↓                          │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
│  🎨 Colores Corporativos                                │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Color de Fondo       Color Primario                    │
│  ┌────┐ ░░░░░░░░░░   ┌────┐ ░░░░░░░░░░               │
│  │    │ #FFFFFF      │    │ #0E4A22                    │
│  └────┘ ░░░░░░░░░░   └────┘ ░░░░░░░░░░               │
│                                                         │
│  Color Secundario      Color de Acento                 │
│  ┌────┐ ░░░░░░░░░░   ┌────┐ ░░░░░░░░░░               │
│  │    │ #963821      │    │ #E0DA62                    │
│  └────┘ ░░░░░░░░░░   └────┘ ░░░░░░░░░░               │
│                                                         │
│              [Restaurar]  [Guardar Config]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎯 9 Posiciones Disponibles

```
Arriba              Arriba              Arriba
Izquierda           Centro              Derecha
  ┌─┐               ┌───┐               ┌─┐
  │▼│               │ ▼ │               │▼│
  └─┘               └───┘               └─┘
┌───────────────────────────────────────────┐
│                                           │
│ Centro                             Centro │
│ Izquierda                         Derecha │
│   ┌─┐                               ┌─┐  │
│   │▶│     [CONTENIDO PRINCIPAL]    │◀│  │
│   └─┘                               └─┘  │
│                                           │
│                                           │
└───────────────────────────────────────────┘
  ┌─┐               ┌───┐               ┌─┐
  │▲│               │ ▲ │               │▲│
  └─┘               └───┘               └─┘
Abajo              Abajo               Abajo
Izquierda          Centro              Derecha
```

## 📊 Tabla de Opacidades

```
Opacidad: 5%
╔════════════════════════════════╗
║  Logo casi invisible (muy sutil) ║
╚════════════════════════════════╝

Opacidad: 15% (RECOMENDADO)
╔════════════════════════════════╗
║  Logo visible pero no obstructivo ║
╚════════════════════════════════╝

Opacidad: 25%
╔════════════════════════════════╗
║  Logo bastante visible          ║
╚════════════════════════════════╝

Opacidad: 40%
╔════════════════════════════════╗
║  Logo muy prominente            ║
╚════════════════════════════════╝
```

## 🔄 Flujo de Cambios

```
Super Admin                    Base de Datos              Dashboard
    │                             │                          │
    │─ Subir Logo ─────────────→  │                          │
    │                             │                          │
    │─ Configurar Settings ─────→ │                          │
    │                             │  ← Leer configuración ──┤
    │                             │                          │
    │─ Guardar ──────────────────→ │                          │
    │                             │  ← Actualizar Dashboard ┤
    │                             │                          │
    │← Confirmación ───────────← │  ← Mostrar Logo ────────┤
    │   "Guardado exitosamente"   │                          │
    │                             │                   [Logo visible]
```

## 🎨 Ejemplos de Configuración

### Ejemplo 1: Branding Corporativo (RECOMENDADO)
```
┌─────────────────────────────────────────┐
│          Dashboard Principal             │
│                                          │
│                                          │
│              [LOGO] ← Opacidad 15%       │
│             Posición: Centro             │
│                                          │
│  Colores:                                │
│  - Primario: #0E4A22 (Verde oscuro)      │
│  - Secundario: #963821 (Marrón)          │
│  - Acento: #E0DA62 (Amarillo)            │
│                                          │
│  ✅ Visibilidad: Perfecta                │
│  ✅ Profesional: Sí                      │
│  ✅ Obstaculiza: No                      │
└─────────────────────────────────────────┘
```

### Ejemplo 2: Logo Sutil (ESQUINA)
```
┌─────────────────────────────────────────┐
│          Dashboard Principal             │
│                                          │
│                                          │
│  [Contenido principal sin obstáculos]    │
│                                          │
│                                          │
│                                          │
│                    [Logo] ← 10% opacidad│
│                   Esquina inferior       │
│                                          │
│  ✅ Discreta: Sí                         │
│  ✅ Profesional: Sí                      │
│  ✅ Obstaculiza: No                      │
└─────────────────────────────────────────┘
```

### Ejemplo 3: Branding Fuerte (VISIBLE)
```
┌─────────────────────────────────────────┐
│          Dashboard Principal             │
│                                          │
│              [LOGO GRANDE]               │
│            Opacidad: 35%                 │
│            Posición: Centro              │
│                                          │
│        [Contenido sobre logo]            │
│                                          │
│                                          │
│  ✅ Visibilidad: Muy alta                │
│  ✅ Impacto: Fuerte                      │
│  ✓ Obstaculiza: Ligeramente              │
└─────────────────────────────────────────┘
```

## 🔐 Control de Acceso Visual

```
┌─────────────────────────────────────────┐
│        USUARIO FINAL (No Admin)         │
│                                         │
│  ✅ Ve el logo + colores                │
│  ✅ Los cambios se aplican automáticamente│
│  ❌ No puede cambiar configuración       │
│  ❌ Sin acceso a Configuración del Sistema│
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      SUPER ADMINISTRADOR                │
│                                         │
│  ✅ Ve el logo + colores                │
│  ✅ Puede cambiar configuración          │
│  ✅ Subir nuevo logo                    │
│  ✅ Cambiar opacidad y posición         │
│  ✅ Personalizar colores                │
│  ✅ Los cambios se aplican al instante  │
│                                         │
└─────────────────────────────────────────┘
```

## 📱 Responsive Design

```
DESKTOP (1920x1080)          TABLET (768x1024)        MOBILE (375x812)
┌──────────────────┐         ┌─────────────┐         ┌─────────┐
│  LOGO            │         │  LOGO       │         │ LOGO    │
│  (Visible)       │         │  (Visible)  │         │ (Menor) │
│                  │         │             │         │         │
│  [Dashboard]     │         │ [Dashboard] │         │[Dashb.. │
│  [Contenido]     │         │ [Contenido] │         │[Conten..│
│                  │         │             │         │         │
└──────────────────┘         └─────────────┘         └─────────┘

✅ Se adapta a cualquier tamaño de pantalla
✅ Logo siempre visible correctamente
✅ Responsive en todas las posiciones
```

## 🎯 Matriz de Decisiones

```
¿Qué logo usar?
│
├─ Sencillo → PNG transparente (ideal)
├─ Complejo → SVG (escalable)
├─ Fotográfico → JPG (comprimido)
└─ Moderno → WEBP (mejor calidad)

¿Qué posición?
│
├─ Centrado → Máximo impacto (recomendado)
├─ Esquina → No obstruye contenido
├─ Arriba → Profesional
└─ Abajo → Sutil

¿Qué opacidad?
│
├─ 5-10% → Casi imperceptible
├─ 15-20% → Equilibrado (recomendado)
├─ 25-35% → Muy visible
└─ 40-50% → Dominante
```

## ✅ Checklist de Implementación

```
ANTES DE USAR:
☐ Logo preparado (JPG/PNG/SVG/WEBP)
☐ Tamaño < 5 MB
☐ Resolución mínima 500x500px
☐ Transparencia si es PNG/SVG

DURANTE LA CONFIGURACIÓN:
☐ Acceder a Configuración del Sistema
☐ Ir a "Marca y Marca de Agua"
☐ Subir logo
☐ Activar watermark
☐ Ajustar opacidad
☐ Seleccionar posición
☐ Personalizar colores (opcional)
☐ Guardar configuración

DESPUÉS DE GUARDAR:
☐ Logo visible en dashboard
☐ Todos los usuarios ven cambios
☐ Sin necesidad de recarga manual
☐ Persistencia en base de datos

VALIDACIÓN:
☐ Logo se ve correctamente
☐ Opacidad es la deseada
☐ No obstruye contenido importante
☐ Colores corporativos aplican
```

## 🚀 Próximos Pasos

```
Configuración Básica (Hoy)
    ↓
Personalización Completa
    ↓
Validación con Usuarios
    ↓
Monitoreo y Mejoras
    ↓
Optimización Final ✅
```

---

**Versión**: 1.0  
**Última actualización**: 2024  
**Plataforma**: Tecavo Soft
