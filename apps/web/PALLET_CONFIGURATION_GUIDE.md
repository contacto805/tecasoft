# Guía de Configuración de Tarimas

## Descripción General

El módulo de Configuración de Tarimas permite establecer los materiales necesarios para cada tipo de tarima utilizada en la producción. Una vez configurados, estos materiales se deducen automáticamente del inventario cuando se registra una tarima en el módulo de producción.

## Características

✅ **Crear Configuraciones de Tarimas**
- Define tarimas con nombre, tipo, capacidad y peso
- Especifica los materiales necesarios para cada tarima

✅ **Gestión de Materiales**
- Asocia múltiples materiales a cada configuración
- Define la cantidad requerida de cada material

✅ **Deducción Automática de Inventario**
- Cuando se aplica una configuración en producción, los materiales se deducen automáticamente
- Se registra un historial de deducción para auditoría

✅ **Control de Inventario**
- Sistema previene deducir más materiales de los disponibles
- Muestra advertencias claras cuando hay inventario insuficiente

## Tablas de Base de Datos

### pallet_configurations
```sql
- id: Identificador único
- pallet_name: Nombre descriptivo (ej: "Tarima 10kg (96 cajas)")
- pallet_type: Tipo de tarima (ej: "10kg-96")
- boxes_capacity: Cantidad de cajas que cabe
- total_weight_kg: Peso total de la tarima
- description: Descripción adicional
- is_active: Estado activo/inactivo
- created_at, updated_at: Fechas de registro
```

### pallet_materials
```sql
- id: Identificador único
- pallet_config_id: Referencia a la configuración (FK)
- material_id: Referencia al material en inventario (FK)
- quantity_required: Cantidad necesaria por tarima
- unit: Unidad de medida
- notes: Notas adicionales
- created_at, updated_at: Fechas de registro
```

## Flujo de Trabajo

### 1. Configuración Inicial
1. Ve al módulo **Config. de Tarimas**
2. Haz clic en **Nueva Configuración**
3. Completa los datos de la tarima:
   - Nombre (obligatorio)
   - Tipo
   - Capacidad de cajas
   - Peso total
   - Descripción

### 2. Agregar Materiales
1. En la sección "Materiales Necesarios", selecciona un material del inventario
2. Especifica la cantidad requerida
3. Haz clic en **Agregar Material**
4. Repite para cada material necesario
5. Guarda la configuración

### 3. Aplicar en Producción
Cuando registres tarimas en el módulo de Producción:
1. Usa el botón **Aplicar Configuración de Tarima**
2. Selecciona la configuración
3. Especifica cuántas tarimas necesitas
4. Revisa los materiales a deducir
5. Confirma - se deducen automáticamente del inventario

### 4. Edición y Eliminación
- **Editar**: Haz clic en el ícono de edición en cualquier configuración
- **Eliminar**: Haz clic en el ícono de papelera (requiere confirmación)

## Ejemplos Prácticos

### Ejemplo 1: Tarima 10kg con 96 cajas

**Configuración:**
- Nombre: Tarima 10kg (96 cajas)
- Tipo: 10kg-96
- Capacidad: 96 cajas
- Peso: 960 kg

**Materiales necesarios:**
- Madera - Tarima Base: 1 pieza
- Plástico - Envoltura: 2 rollos
- Cinta - Adhesiva: 1 rollo
- Etiqueta - Código de Barras: 96 piezas
- Papel - Separador: 1 pieza

### Ejemplo 2: Tarima 6kg

**Configuración:**
- Nombre: Tarima 6kg
- Tipo: 6kg
- Capacidad: 150 cajas
- Peso: 900 kg

**Materiales necesarios:**
- Madera - Tarima Base: 1 pieza
- Plástico - Envoltura: 2.5 rollos
- Cinta - Adhesiva: 1.5 rollos
- Etiqueta - Código de Barras: 150 piezas

## API Endpoints

### GET /api/pallet-configurations
Obtiene todas las configuraciones o una específica.

**Parámetros:**
- `id` (opcional): ID de configuración específica

**Respuesta:**
```json
[
  {
    "id": 1,
    "pallet_name": "Tarima 10kg (96 cajas)",
    "pallet_type": "10kg-96",
    "boxes_capacity": 96,
    "total_weight_kg": 960,
    "description": "...",
    "material_count": 5,
    "materials": [
      {
        "id": 1,
        "material_id": 1,
        "material_name": "Madera - Tarima Base",
        "quantity_required": 1,
        "unit": "piezas"
      }
    ]
  }
]
```

### POST /api/pallet-configurations
Crea una nueva configuración de tarima.

**Body:**
```json
{
  "pallet_name": "Tarima 10kg (96 cajas)",
  "pallet_type": "10kg-96",
  "boxes_capacity": 96,
  "total_weight_kg": 960,
  "description": "...",
  "materials": [
    {
      "material_id": 1,
      "quantity_required": 1,
      "unit": "piezas"
    }
  ]
}
```

### PUT /api/pallet-configurations
Actualiza una configuración existente.

**Body:**
```json
{
  "id": 1,
  "pallet_name": "Tarima 10kg (96 cajas)",
  "materials": [...]
}
```

### DELETE /api/pallet-configurations?id=1
Elimina una configuración.

### POST /api/pallet-configurations/apply
Aplica una configuración y deduce materiales del inventario.

**Body:**
```json
{
  "pallet_config_id": 1,
  "quantity": 5,
  "production_batch_id": 10,
  "lot_id": 20
}
```

**Respuesta:**
```json
{
  "success": true,
  "pallet_config": {...},
  "quantity_applied": 5,
  "deductedMaterials": [
    {
      "material_id": 1,
      "material_name": "Madera - Tarima Base",
      "quantity_deducted": 5,
      "unit": "piezas"
    }
  ],
  "message": "Materiales deducidos exitosamente para 5 tarima(s)"
}
```

## Validaciones y Errores

### ✅ Éxito
- Configuración creada correctamente
- Materiales deducidos del inventario
- Se registra en auditoría de sincronización

### ❌ Errores Comunes

**"El nombre de la tarima es requerido"**
- Asegúrate de llenar el campo "Nombre de Tarima"

**"Inventario insuficiente para los materiales"**
- Uno o más materiales no tienen suficiente cantidad
- Muestra exactamente qué materiales faltan y cuántos
- Agrega más material al inventario antes de aplicar

**"Configuración no encontrada"**
- La configuración fue eliminada
- Selecciona una configuración válida

## Integración con Otros Módulos

### Inventario
- Los materiales deben estar registrados en el módulo de Inventario
- Las cantidades se actualizan en tiempo real

### Módulo de Producción
- Integración a través del componente `PalletMaterialsModal`
- Se puede usar en el flujo de registro de tarimas

### Sistema de Sincronización
- Cada deducción se registra en `sync_audit_log`
- Permite auditoría completa de cambios

## Mejores Prácticas

1. **Configura primero**
   - Establece todas las configuraciones antes de iniciar producción

2. **Verifica el inventario**
   - Asegúrate de tener suficientes materiales antes de aplicar configuraciones

3. **Mantén actualizado**
   - Si cambian los materiales de una tarima, edita la configuración
   - No crees duplicados

4. **Revisa las cantidades**
   - Verifica que las cantidades en la configuración sean correctas
   - El sistema multiplica por la cantidad de tarimas solicitadas

5. **Control de cambios**
   - Todos los cambios quedan registrados para auditoría
   - Revisa el historial de deducción en `material_deductions`

## Troubleshooting

**Las configuraciones no aparecen:**
- Asegúrate de haber guardado correctamente
- Recarga la página
- Verifica que tengas permisos de lectura

**Los materiales no se deducen:**
- Verifica que los materiales estén en el inventario
- Comprueba que haya suficiente cantidad
- Revisa los logs para mensajes de error específicos

**Inventario negativo:**
- No debería ocurrir - el sistema lo previene
- Si sucede, contacta al equipo de soporte
