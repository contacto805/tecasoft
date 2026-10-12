# Guía de Testing: Botón "Guardar Lote" - Registro de Lotificación

## Pre-requisitos
- ✅ App en ejecución
- ✅ Servidor Next.js iniciado
- ✅ Base de datos conectada
- ✅ Lotes disponibles (crear desde /fruit-input si es necesario)

---

## TESTING STEP-BY-STEP

### PASO 1: Abrir Registro de Lotificación
1. Ve a la app principal
2. En el navegador, busca **"Registro de Lotificación"**
3. Deberías ver:
   - Panel izquierdo: "Lotes Disponibles"
   - Panel derecho: "Selecciona un lote para comenzar..."

**✓ Resultado esperado:**
- Página cargó correctamente
- No hay errores rojos en la consola

---

### PASO 2: Verificar Carga de Lotes
1. Observa el panel izquierdo
2. En la cabecera, deberías ver: `Actualización automática cada 30 seg`
3. Deberías ver una lista de lotes como:
   - `LOTE-001` - Juan Pérez - Aguacate - 10 ene
   - `LOTE-002` - María García - Mango - 09 ene

**✓ Si funciona:**
- ✅ API `/api/lots` está respondiendo
- ✅ Base de datos tiene lotes
- ✅ Sincronización está activa

**✗ Si NO funciona:**
- [ ] Abre DevTools (F12) → Consola
- [ ] Busca: "Error fetching /api/lots"
- [ ] Si ves: "Unexpected token '<'" → Servidor con error
- [ ] Solución: Reiniciar servidor (`npm run dev`)

---

### PASO 3: Seleccionar un Lote
1. Haz clic en cualquier lote de la lista (ejemplo: LOTE-001)
2. El lote debe cambiar de color (fondo azul claro)
3. En el panel derecho deberías ver:
   - **Información del Lote** (Número, Productor, Tipo Fruta, Fecha)
   - **Datos Generales** (Fecha Selección, Total Kilos Recibidos)
   - **Kilos y Precios por Calibre** (tabla con calibres)
   - **Resumen de Cálculos** (cajas azules)
   - **Botones de acción** (Calcular, GUARDAR, Limpiar)

**✓ Resultado esperado:**
- Lote seleccionado se destaca
- Formulario aparece en el lado derecho
- Sin errores

---

### PASO 4: Probar Validaciones (Sin llenar datos)
1. Con un lote seleccionado, haz clic en **"GUARDAR REGISTRO DE LOTIFICACIÓN"**
2. Deberías ver una alerta:
   ```
   ❌ Por favor ingresa el total de kilos recibidos en empaque (debe ser mayor a 0)
   ```

**✓ Resultado esperado:**
- Aparece alerta de validación
- Botón NO se deshabilita (puedes hacer clic de nuevo)
- El formulario NO se limpia

---

### PASO 5: Llenar el Formulario Correctamente
**Ingresa estos datos:**

| Campo | Valor |
|-------|-------|
| **Fecha de Selección** | 2024-01-15 (o hoy) |
| **Total de Kilos Recibidos** | 500 |
| **Calibres** | |
| - Super | 100 kg, $5.50/kg |
| - Extra | 150 kg, $4.80/kg |
| - Primera | 150 kg, $3.20/kg |
| - Mediano | 100 kg, $2.10/kg |

**Acciones:**
1. Presiona en el campo "Total de Kilos Recibidos"
2. Ingresa: `500`
3. Presiona en fila "Super" → Campo Kilos
4. Ingresa: `100`
5. Presiona en fila "Super" → Campo Precio
6. Ingresa: `5.50`
7. Repite para los otros calibres

**✓ Observa cómo el formulario se actualiza automáticamente:**
- Total Kilos por Calibre: 500.00 kg
- Precio Real por Lote: $4.15/kg (promedio ponderado)
- Variación: 0.00 kg (perfecta coincidencia)
- Desglose por Calibre: muestra cada calibre con su cálculo

---

### PASO 6: TEST DEL BOTÓN "GUARDAR"
1. Con el formulario lleno correctamente, presiona: **"GUARDAR REGISTRO DE LOTIFICACIÓN"**

**Esperado en TIEMPO REAL:**

| Segundo | Evento |
|---------|--------|
| 0 | Botón se desactiva (color gris) |
| 0 | Aparece spinner (círculo animado) |
| 0 | Texto cambia a "Guardando Registro..." |
| 0-2 | Spinner gira continuamente |
| 2-3 | Alerta de éxito aparece |
| 3+ | Alerta se cierra |
| 4 | Botón se habilita nuevamente |
| 5 | Formulario está vacío |
| 5 | Puedes seleccionar otro lote |

**Alerta de éxito esperada:**
```
✅ Registro de lotificación guardado exitosamente

Lote: LOTE-001
Total procesado: 500.00 kg
```

---

### PASO 7: Verificar Guardado en Base de Datos
1. En la consola del navegador (F12)
2. Busca logs con: `✅ Registro de lotificación guardado`
3. Deberías ver console.log en azul:
   ```
   📋 Form onSubmit disparado
   [Request Body JSON]
   [Response JSON con success: true]
   ```

**Para verificación avanzada:**
- Abre PgAdmin o herramienta de BD
- Tabla `lotification_registry` debe tener nuevo registro
- Tabla `lotification_calibers` debe tener 4 nuevos registros (uno por calibre)

---

### PASO 8: Probar Casos de Error

#### Caso A: Sin seleccionar lote
1. Limpia el formulario (Botón "Limpiar")
2. Presiona "GUARDAR"
3. Esperado: Alerta "Por favor selecciona un lote de la lista"

#### Caso B: Sin kilos recibidos
1. Selecciona un lote
2. Deja vacío "Total de Kilos Recibidos"
3. Presiona "GUARDAR"
4. Esperado: Alerta sobre kilos recibidos

#### Caso C: Sin calibres ingresados
1. Selecciona un lote
2. Ingresa 500 en "Total de Kilos Recibidos"
3. NO llenes ningún calibre
4. Presiona "GUARDAR"
5. Esperado: Alerta "Debe ingresar al menos un calibre con kilos"

---

### PASO 9: Probar Botón "Calcular Totales"
1. Llena el formulario con algunos datos
2. Presiona: **"Calcular Totales"** (botón gris)
3. Esperado: Alerta con resumen:
   ```
   📊 Cálculo actualizado:

   Total Kilos: 500.00 kg
   Precio Real: 4.15/kg
   ```

---

### PASO 10: Probar Botón "Limpiar Formulario"
1. Llena el formulario completamente
2. Presiona: **"Limpiar Formulario"** (botón blanco)
3. Aparece confirmación: "¿Deseas limpiar todos los campos del formulario?"
4. Presiona "OK" en la confirmación
5. Esperado:
   - Todos los campos de calibres se vacían
   - "Total de Kilos Recibidos" se vacía
   - Lote seleccionado se deselecciona
   - Panel derecho vuelve a mostrar: "Selecciona un lote..."

---

## Checklist de Verificación Completa

```
CARGA DE PÁGINA
[ ] Página carga sin errores
[ ] Lotes se cargan en el panel izquierdo
[ ] No hay errores rojos en consola

SELECCIÓN DE LOTE
[ ] Puedo seleccionar un lote
[ ] Lote se destaca visualmente
[ ] Formulario aparece en el lado derecho

LLENADO DE FORMULARIO
[ ] Puedo ingresar fecha
[ ] Puedo ingresar kilos recibidos
[ ] Puedo ingresar kilos por calibre
[ ] Puedo ingresar precios
[ ] Porcentajes se calculan automáticamente
[ ] Precio real se recalcula automáticamente
[ ] Variación se actualiza correctamente

BOTÓN GUARDAR
[ ] Botón se desactiva al presionar
[ ] Spinner aparece
[ ] Texto cambia a "Guardando..."
[ ] Alerta de éxito aparece (2-3 seg)
[ ] Alerta se cierra automáticamente
[ ] Formulario se limpia
[ ] Botón se habilita nuevamente
[ ] Puedo hacer otro registro

VALIDACIONES
[ ] Sin lote: muestra error
[ ] Sin kilos recibidos: muestra error
[ ] Sin calibres: muestra error
[ ] Todos los campos vacíos: muestra error

BOTONES AUXILIARES
[ ] "Calcular Totales" funciona
[ ] "Limpiar Formulario" funciona y pide confirmación
[ ] "Refrescar" (arriba) actualiza lotes

BASE DE DATOS
[ ] Datos se guardan en lotification_registry
[ ] Calibres se guardan en lotification_calibers
[ ] IDs se vinculan correctamente
[ ] Timestamps se guardan
```

---

## Debugging Guide

### Si el botón NO responde:

1. **Abre DevTools (F12)**
2. **Ve a Consola**
3. **Presiona el botón "GUARDAR"**
4. **Busca:** "📋 Form onSubmit disparado"

**Si la ves:** ✅ handleSubmit se ejecutó
**Si NO la ves:** ❌ Problema en el evento onSubmit

### Si no aparece alerta:

1. Busca en consola: "Error de conexión" o "Error al guardar"
2. Verifica que el endpoint `/api/lotification-registry` exista
3. Verifica que la BD esté conectada

### Si los datos NO se guardan:

1. Verifica respuesta del API en Consola
2. Busca: mensajes con `status: 500` o `error:`
3. Revisa los logs del servidor

---

## Resultado Final Esperado

Después de completar todos los tests, deberías poder:

✅ **Crear registros de lotificación sin errores**
✅ **Ver spinner y feedback visual al guardar**
✅ **Recibir confirmación de éxito**
✅ **Verificar datos en base de datos**
✅ **Crear múltiples registros en secuencia**

---

**Estado: ✅ BOTÓN COMPLETAMENTE FUNCIONAL**

Si todos los tests pasan, el botón está 100% operativo.

Si algún test falla, reportar el número del paso y el error específico.
