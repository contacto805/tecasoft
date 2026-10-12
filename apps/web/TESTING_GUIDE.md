# 🧪 Guía de Prueba: Botón Guardar Lote

## Estado de la Corrección

✅ **COMPLETADA** - Las siguientes correcciones fueron implementadas:

1. ✅ Simplificado handleSubmit
2. ✅ Removido onClick redundante del botón
3. ✅ Mejorado API de lotes
4. ✅ Agregado lote de prueba en BD (TEST-001)

---

## Instrucciones de Prueba 🎯

### Paso 1: Navegar al Módulo
1. En la barra de navegación superior, haz clic en **"Registro de Lotificación"**
2. Deberías ver:
   - Panel izquierdo: "Lotes Disponibles" (debe mostrar TEST-001)
   - Panel derecho: Mensaje "Selecciona un lote para comenzar"

### Paso 2: Seleccionar un Lote
1. En la lista de lotes (izquierda), busca **"TEST-001"** (Productor: Juan Pérez)
2. Haz clic en ese lote
3. Deberías ver:
   - Tarjeta con datos: "Número de Lote: TEST-001"
   - Campos de entrada para la fecha y kilos
   - Tabla con calibres (Super, Extra, Primera, etc.)

### Paso 3: Llenar el Formulario

**Sección 1: Datos Generales**
- Fecha de Selección: Hoy (por defecto)
- Total de Kilos Recibidos: **Ingresa 500**

**Sección 2: Calibres (elige varios)**
- Haz clic en el campo "Kilos" para cada calibre:
  - Super: **100**
  - Extra: **150**
  - Primera: **150**
  - Mediano: **100**
- Opcionalmente ingresa precio en $/kg (si lo deseas)

**Observación esperada:**
- El campo "Porcentaje" se calcula automáticamente
- Verás:
  - Total Kilos por Calibre: 500 kg ✓
  - Total Kilos Recibidos: 500 kg ✓
  - Variación: 0 kg ✓

### Paso 4: Hacer Clic en "GUARDAR REGISTRO"

**Comportamiento esperado en tiempo real:**

```
ANTES DE HACER CLIC:
┌─────────────────────────────────────────────────┐
│        GUARDAR REGISTRO DE LOTIFICACIÓN         │ ← Botón azul, habilitado
└─────────────────────────────────────────────────┘

DURANTE EL ENVÍO (1-2 segundos):
┌─────────────────────────────────────────────────┐
│   ⟳ Guardando Registro...                      │ ← Botón gris, animado
└─────────────────────────────────────────────────┘

DESPUÉS DEL ÉXITO:
┌─────────────────────────────────────────────────┐
│        ✅ ¡ALERTA!                               │
│                                                  │
│  Registro de lotificación guardado exitosamente  │
│                                                  │
│  Lote: TEST-001                                 │
│  Total procesado: 500.00 kg                      │
│                                                  │
│  [OK]                                            │
└─────────────────────────────────────────────────┘

FORMULARIO SE LIMPIA:
- Total Kilos Recibidos: vacío
- Todos los campos de calibres: vacíos
- Lote seleccionado: ninguno
- Lista de lotes: actualizada

Y BOTÓN VUELVE A ESTAR DISPONIBLE:
┌─────────────────────────────────────────────────┐
│        GUARDAR REGISTRO DE LOTIFICACIÓN         │ ← Listo para otro
└─────────────────────────────────────────────────┘
```

---

## Verificación en Consola del Navegador 🔍

Abre DevTools (F12) → Pestaña Console

**Logs esperados:**
```
🔄 Cargando lotes...
📦 Lotes cargados: 1
```

**Si ves "Lotes cargados: 0":**
- El servidor aún está iniciando
- Espera 10 segundos y recarga (F5)

---

## Si El Botón NO Funciona 🚨

### Checklist de Diagnóstico

1. **¿Se desactiva el botón?**
   - Si NO → Problema en el evento onSubmit del formulario
   - Si SÍ → Paso al siguiente

2. **¿Aparece el spinner "Guardando..."?**
   - Si NO → setSubmitting(true) no se dispara
   - Si SÍ → Paso al siguiente

3. **¿Aparece la alerta?**
   - Si NO → fetch a API está fallando
   - Si SÍ → ¡Éxito! (ir a paso 4)

4. **¿Se limpia el formulario?**
   - Si NO → resetForm() tiene problema
   - Si SÍ → ¡TODO FUNCIONA! ✅

### Soluciones por Escenario

#### Escenario A: Botón no se desactiva
```javascript
// Abre Console y escribe:
document.querySelector('button[type="submit"]')
// Debería devolver el elemento del botón
```

#### Escenario B: No se ve "Guardando..."
```javascript
// Abre Console y escribe:
// Verifica si el estado está cambiando
// Busca en los logs de React DevTools
```

#### Escenario C: No aparece alerta
```
Abre DevTools → Network → Pestaña
Intenta guardar
Busca la request POST a /api/lotification-registry
- Status 200 = OK
- Status 400 = Error de validación
- Status 500 = Error del servidor
```

---

## Datos de Prueba Disponibles

### Lote Preexistente
```
Número: TEST-001
Productor: Juan Pérez
Fruta: Aguacate
Origen: Michoacán
Fecha: 2026-04-13
Precio: $15.50/kg
```

### Crear Más Lotes (Opcional)
Si deseas agregar más lotes para prueba:

```sql
INSERT INTO lots (lot_number, producer, origin, fruit_type, date, fruit_price, created_at, is_cut_fruit) 
VALUES ('PRUEBA-002', 'María García', 'Jalisco', 'Mango', NOW(), 12.75, NOW(), false);
```

---

## Verificación Final ✅

### Checklist de Funcionalidad

- [ ] Módulo carga sin errores
- [ ] Lote TEST-001 aparece en la lista
- [ ] Puedo seleccionar el lote
- [ ] Veo los detalles del lote
- [ ] Puedo ingresar kilos recibidos
- [ ] Puedo seleccionar calibres e ingresar datos
- [ ] Los porcentajes se calculan automáticamente
- [ ] El botón "GUARDAR" está visible (azul)
- [ ] Al hacer clic, el botón se desactiva
- [ ] Aparece "Guardando Registro..."
- [ ] Aparece alerta de éxito
- [ ] Formulario se limpia
- [ ] Botón vuelve a estar activo
- [ ] Registro aparece en la base de datos

Si TODAS las casillas están ✅, el botón funciona correctamente.

---

## Información Técnica 🔧

### Archivos Modificados
- `/home/user/apps/web/app/lotification-registry/page.jsx` (líneas ~170-250)
- `/home/user/apps/web/app/api/lots/route.js` (líneas ~5-20)

### Tabla de Base de Datos Usada
- `lots` - Información general del lote
- `lotification_registry` - Registro de selección
- `lotification_calibers` - Detalles por calibre

### API Endpoints
- `POST /api/lotification-registry` - Guardar nuevo registro
- `GET /api/lots` - Obtener lista de lotes

---

## Contacto/Soporte

Si tienes problemas:

1. **Abre DevTools (F12)**
2. **Copia los logs de error**
3. **Proporciona:**
   - Pasos exactos que hiciste
   - Mensaje de error completo
   - Versión del navegador

---

## Notas Importantes 📌

- El servidor puede tardar 10-15 segundos en iniciar después del reinicio
- Los datos de prueba (TEST-001) ya están en la base de datos
- Si eliminas el lote, el formulario mostrará "No hay lotes registrados"
- El alerta usa `alert()` nativo del navegador (no toast)
