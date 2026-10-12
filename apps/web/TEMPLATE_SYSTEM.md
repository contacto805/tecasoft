# Template System Documentation - Tecavo Fruits Soft

## Overview

The Template System allows users to save predefined configurations for fruit input entries. Users can quickly load templates to auto-populate form fields (fruit type, producer, origin, pricing, collector info) and create new templates from current configurations.

## Features

### 1. **Load Templates**
- Access saved templates from the quick-load section at the top of the Fruit Input form
- Click "Cargar Plantilla" to auto-fill all related fields
- Delete unused templates with the trash icon
- View template details (fruit type, producer, description)

### 2. **Save as Template**
- Click "Guardar como Plantilla" button in the Datos del Lote section
- Enter template name (required) and description (optional)
- Preview what data will be saved
- Save configurations for reuse across multiple entries

### 3. **Template Management**
- View all saved templates in the quick-load section
- Edit templates by loading them, modifying fields, and saving with a new name
- Delete templates individually with confirmation
- Limit: One template name per user (unique constraint)

## Database Schema

```sql
CREATE TABLE input_templates (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fruit_type TEXT,
  producer TEXT,
  origin TEXT,
  is_cut_fruit BOOLEAN DEFAULT FALSE,
  fruit_price NUMERIC(10,2),
  collector_name TEXT,
  commission_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

## API Endpoints

### GET /api/templates
Retrieve all templates for a user.

**Query Parameters:**
- `userId` (optional): User identifier, defaults to 'default-user'

**Response:**
```json
[
  {
    "id": 1,
    "user_id": "default-user",
    "name": "Template Hass Estándar",
    "description": "Configuración rápida para Aguacate Hass",
    "fruit_type": "Aguacate Hass",
    "producer": "Productor Default",
    "origin": "Huerto La Loma",
    "is_cut_fruit": false,
    "fruit_price": 3.50,
    "collector_name": "Acopiador Principal",
    "commission_amount": null,
    "created_at": "2024-12-28T10:00:00.000Z",
    "updated_at": "2024-12-28T10:00:00.000Z"
  }
]
```

### POST /api/templates
Create a new template.

**Request Body:**
```json
{
  "userId": "default-user",
  "name": "My Custom Template",
  "description": "Optional description",
  "fruitType": "Aguacate Hass",
  "producer": "Juan Pérez",
  "origin": "Huerto La Loma",
  "isCutFruit": false,
  "fruitPrice": 3.50,
  "collectorName": "Acopiador Principal",
  "commissionAmount": 100
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "user_id": "default-user",
  "name": "My Custom Template",
  "description": "Optional description",
  "fruit_type": "Aguacate Hass",
  "producer": "Juan Pérez",
  "origin": "Huerto La Loma",
  "is_cut_fruit": false,
  "fruit_price": 3.50,
  "collector_name": "Acopiador Principal",
  "commission_amount": 100,
  "created_at": "2024-12-28T10:15:00.000Z",
  "updated_at": "2024-12-28T10:15:00.000Z"
}
```

**Error Response (409 Conflict):**
```json
{
  "error": "Ya existe un template con este nombre"
}
```

### PUT /api/templates
Update an existing template.

**Request Body:**
```json
{
  "id": 5,
  "name": "Updated Template Name",
  "description": "Updated description",
  "fruitType": "Aguacate Mendez",
  "producer": "María García",
  "origin": "Huerto San Miguel",
  "isCutFruit": true,
  "fruitPrice": 4.20,
  "collectorName": "Acopiador Exportación",
  "commissionAmount": 150
}
```

**Response (200 OK):**
```json
{
  "id": 5,
  "user_id": "default-user",
  "name": "Updated Template Name",
  "description": "Updated description",
  "fruit_type": "Aguacate Mendez",
  "producer": "María García",
  "origin": "Huerto San Miguel",
  "is_cut_fruit": true,
  "fruit_price": 4.20,
  "collector_name": "Acopiador Exportación",
  "commission_amount": 150,
  "created_at": "2024-12-28T10:15:00.000Z",
  "updated_at": "2024-12-28T10:20:00.000Z"
}
```

### DELETE /api/templates
Delete a template.

**Query Parameters:**
- `id` (required): Template ID

**Response (200 OK):**
```json
{
  "success": true,
  "id": 5
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Template no encontrado"
}
```

## Usage Examples

### JavaScript/React Frontend

```javascript
// Load all templates
async function loadTemplates() {
  const response = await fetch('/api/templates?userId=default-user');
  const templates = await response.json();
  console.log(templates);
}

// Create a new template
async function createTemplate() {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'default-user',
      name: 'Quick Entry - Hass',
      description: 'Fast entry for Hass avocados',
      fruitType: 'Aguacate Hass',
      producer: 'Juan Pérez',
      origin: 'Huerto La Loma',
      fruitPrice: 3.50,
      collectorName: 'Acopiador Principal'
    })
  });
  const template = await response.json();
  console.log('Template created:', template);
}

// Update a template
async function updateTemplate(templateId) {
  const response = await fetch('/api/templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: templateId,
      name: 'Updated Hass Template',
      fruitPrice: 3.75
    })
  });
  const updated = await response.json();
  console.log('Template updated:', updated);
}

// Delete a template
async function deleteTemplate(templateId) {
  const response = await fetch(`/api/templates?id=${templateId}`, {
    method: 'DELETE'
  });
  const result = await response.json();
  console.log('Deleted:', result.success);
}
```

### cURL Examples

```bash
# Get all templates
curl -X GET "https://your-app.com/api/templates?userId=default-user"

# Create template
curl -X POST "https://your-app.com/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "default-user",
    "name": "Hass Standard",
    "fruitType": "Aguacate Hass",
    "producer": "Juan Pérez",
    "origin": "Huerto La Loma",
    "fruitPrice": 3.50
  }'

# Update template
curl -X PUT "https://your-app.com/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 5,
    "name": "Updated Hass",
    "fruitPrice": 3.75
  }'

# Delete template
curl -X DELETE "https://your-app.com/api/templates?id=5"
```

## Default Templates

The system comes with 3 pre-configured templates:

1. **Template Hass Estándar**
   - Fruit Type: Aguacate Hass
   - Producer: Productor Default
   - Origin: Huerto La Loma
   - Price: $3.50/kg
   - Collector: Acopiador Principal

2. **Template Mendez Exportación**
   - Fruit Type: Aguacate Mendez
   - Producer: Productor Export
   - Origin: Huerto San Miguel
   - Price: $4.20/kg
   - Collector: Acopiador Exportación

3. **Template Fruta de Corte**
   - Fruit Type: Aguacate Hass
   - Price: $2.80/kg
   - Collector: Acopiador Fruta Corte
   - Marked as cut fruit compatible

## Best Practices

1. **Template Naming**: Use clear, descriptive names that indicate the fruit type and purpose
   - ✅ Good: "Template Hass Estándar", "Mendez Exportación"
   - ❌ Bad: "Template 1", "Quick"

2. **Data Consistency**: Only include data in templates that will be reused across multiple entries
   - Store: Fruit type, producer, origin, standard pricing
   - Don't store: Lot numbers, weighing data, photos

3. **Organization**: Create separate templates for:
   - Different fruit types (Hass, Mendez, etc.)
   - Different markets (domestic vs. export)
   - Different seasons or harvest periods
   - Different producers or collectors

4. **Regular Maintenance**: Delete outdated or unused templates to keep the quick-load section clean

## Frontend Integration

The template system is fully integrated into the Fruit Input form (`/app/fruit-input/page.jsx`):

1. **Templates Section**: Displays at the top of the form with quick-load buttons
2. **Apply Template**: Clicking "Cargar Plantilla" auto-fills all relevant fields
3. **Save Template**: Button in Datos del Lote section opens save dialog
4. **Delete Template**: Trash icon on each template card with confirmation

## Error Handling

- **Duplicate Name**: Returns 409 Conflict if template name already exists for user
- **Missing Required Field**: Returns 400 Bad Request if template name is empty
- **Invalid ID**: Returns 404 Not Found if template doesn't exist
- **Server Error**: Returns 500 Internal Server Error with error message

## Performance Considerations

- Templates are loaded once on component mount
- Search/filter does not impact template loading
- Delete operations require confirmation to prevent accidental removal
- Template names are indexed (UNIQUE constraint) for fast lookups

## Future Enhancements

Potential improvements for the template system:
- Template sharing between users
- Category/tag-based template organization
- Template usage analytics
- Bulk template operations
- Template versioning/history
- Template preview before applying
