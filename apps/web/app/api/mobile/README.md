# Tecavo Soft Mobile API Documentation

## Overview
These APIs allow mobile applications to synchronize data with the Tecavo Soft backend. The mobile extension can create, read, update, and delete expenses and fruit input records.

## Base URL
```
https://your-app-domain/api/mobile
```

## Endpoints

### 1. Expenses Management

#### GET /api/mobile/expenses
Get all expenses with optional filtering.

**Query Parameters:**
- `department` (optional): Filter by department (e.g., "Empaque", "Transporte")
- `startDate` (optional): Filter by start date (YYYY-MM-DD)
- `endDate` (optional): Filter by end date (YYYY-MM-DD)
- `syncTimestamp` (optional): Get only records modified after this timestamp (milliseconds)

**Response Example:**
```json
{
  "status": "success",
  "timestamp": 1700000000000,
  "data": [
    {
      "id": 1,
      "product_name": "Cajas",
      "cost_per_unit": 5.50,
      "quantity": 100,
      "total": 550.00,
      "department": "Empaque",
      "notes": "Compra mensual",
      "expense_date": "2024-01-15",
      "photo_url": "https://...",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### POST /api/mobile/expenses
Create a new expense.

**Request Body:**
```json
{
  "productName": "Cajas",
  "costPerUnit": 5.50,
  "quantity": 100,
  "total": 550.00,
  "department": "Empaque",
  "notes": "Compra mensual",
  "expenseDate": "2024-01-15",
  "photoUrl": "https://cdn.example.com/photo.jpg"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Gasto creado exitosamente",
  "data": {
    "id": 1,
    "product_name": "Cajas",
    "cost_per_unit": 5.50,
    "quantity": 100,
    "total": 550.00,
    "department": "Empaque",
    "notes": "Compra mensual",
    "expense_date": "2024-01-15",
    "photo_url": "https://cdn.example.com/photo.jpg",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

#### PUT /api/mobile/expenses
Update an existing expense.

**Request Body:**
```json
{
  "id": 1,
  "productName": "Cajas",
  "costPerUnit": 6.00,
  "quantity": 100,
  "total": 600.00,
  "department": "Empaque",
  "notes": "Precio actualizado",
  "expenseDate": "2024-01-15",
  "photoUrl": "https://cdn.example.com/photo.jpg"
}
```

#### DELETE /api/mobile/expenses?id=1
Delete an expense by ID.

---

### 2. Fruit Input Management

#### GET /api/mobile/fruit-input
Get all fruit input records (lots and weighings).

**Query Parameters:**
- `lotId` (optional): Get specific lot with all its weighings
- `syncTimestamp` (optional): Get only records modified after this timestamp (milliseconds)

**Response Example:**
```json
{
  "status": "success",
  "timestamp": 1700000000000,
  "data": {
    "lots": [
      {
        "id": 1,
        "lot_number": "LOT-2024-001",
        "producer": "Juan García",
        "orchard_name": "Huerta El Paraíso",
        "fruit_type": "Limón",
        "date": "2024-01-15",
        "fruit_price": 25.50,
        "collector_name": "Carlos López",
        "commission_amount": 2.55,
        "payment_days": 7,
        "payment_scheduled_date": "2024-01-22",
        "is_cut_fruit": false,
        "status": "selection",
        "weighing_count": 3,
        "total_kg": 1500.25,
        "total_boxes": 150,
        "created_at": "2024-01-15T08:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "weighings": [
      {
        "id": 1,
        "lot_id": 1,
        "boxes": 50,
        "gross_weight": 500.00,
        "with_pallet": true,
        "net_weight": 480.00,
        "tare_weight": 20.00,
        "photo_url": "https://...",
        "timestamp": "2024-01-15T09:00:00Z",
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-01-15T09:00:00Z"
      }
    ]
  },
  "count": 1
}
```

#### POST /api/mobile/fruit-input
Create a new lot or weighing record.

**For Creating a New Lot:**
```json
{
  "actionType": "createLot",
  "lot_number": "LOT-2024-001",
  "producer": "Juan García",
  "orchard_name": "Huerta El Paraíso",
  "fruit_type": "Limón",
  "date": "2024-01-15",
  "fruit_price": 25.50,
  "collector_name": "Carlos López",
  "commission_amount": 2.55,
  "payment_days": 7,
  "is_cut_fruit": false
}
```

**For Creating a Weighing:**
```json
{
  "actionType": "createWeighing",
  "lot_id": 1,
  "boxes": 50,
  "gross_weight": 500.00,
  "with_pallet": true,
  "net_weight": 480.00,
  "tare_weight": 20.00,
  "photo_url": "https://cdn.example.com/photo.jpg"
}
```

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "status": "error",
  "message": "Descripción del error"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request - Missing or invalid parameters
- `404`: Not Found - Resource not found
- `409`: Conflict - Duplicate record (e.g., duplicate lot number)
- `500`: Server Error - Internal server error

---

## Delta Sync (Incremental Sync)

To reduce bandwidth, use the `syncTimestamp` parameter to get only recently modified records:

```
GET /api/mobile/expenses?syncTimestamp=1700000000000
GET /api/mobile/fruit-input?syncTimestamp=1700000000000
```

The `timestamp` field in the response shows the current server time. Save this value and use it in your next sync request.

---

## Mobile Integration Example

### React Native / Expo Example

```javascript
// Get all expenses
async function fetchExpenses() {
  try {
    const response = await fetch('/api/mobile/expenses');
    const result = await response.json();
    if (result.status === 'success') {
      console.log('Expenses:', result.data);
    }
  } catch (error) {
    console.error('Error fetching expenses:', error);
  }
}

// Create new expense
async function createExpense(expenseData) {
  try {
    const response = await fetch('/api/mobile/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData)
    });
    const result = await response.json();
    if (result.status === 'success') {
      console.log('Expense created:', result.data);
    }
  } catch (error) {
    console.error('Error creating expense:', error);
  }
}

// Create new lot
async function createLot(lotData) {
  try {
    const response = await fetch('/api/mobile/fruit-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'createLot',
        ...lotData
      })
    });
    const result = await response.json();
    if (result.status === 'success') {
      console.log('Lot created:', result.data);
    }
  } catch (error) {
    console.error('Error creating lot:', error);
  }
}

// Record weighing
async function recordWeighing(weighingData) {
  try {
    const response = await fetch('/api/mobile/fruit-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'createWeighing',
        ...weighingData
      })
    });
    const result = await response.json();
    if (result.status === 'success') {
      console.log('Weighing recorded:', result.data);
    }
  } catch (error) {
    console.error('Error recording weighing:', error);
  }
}
```

---

## Notes

1. **Timestamps**: All timestamps are in ISO 8601 format (UTC)
2. **Photo URLs**: Photos should be uploaded to the file storage first, then the URL passed to the API
3. **Authentication**: Currently these endpoints are open. Consider adding authentication headers if needed
4. **Rate Limiting**: No rate limiting is currently implemented, but consider adding it for production
5. **Offline Support**: For offline-first mobile apps, implement local SQLite storage and sync when connection is restored

---

## Support

For issues or questions about the mobile API, contact the development team.
