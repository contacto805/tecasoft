# 📊 AI-Powered Batch Tracking Module

## Overview

The Batch Tracking module provides comprehensive traceability and profitability analysis for each lot from field intake through warehouse return. It automatically pulls data from multiple system modules and calculates real-time profit/loss metrics.

## Key Features

### 1. **Complete Batch Journey Tracking**
- **Ingreso (Intake)**: Field fruit received at processing facility
- **Corte (Cutting)**: Processing, box management, and returns tracking
- **Clasificación (Classification)**: Caliber sorting, yields, waste/loss recording
- **Venta (Sales)**: Revenue from processed products and waste sales

### 2. **Automatic Data Integration**
The system pulls from 5 key data sources:
- **weighings** table: Initial weight and metrics
- **cutting_orders** table: Boxes processed, returned, missing
- **lotification_registry** table: Classification data
- **lotification_records** table: Yield percentages
- **sales_of_process_and_waste** table: Revenue data

### 3. **Real-Time Profitability Analysis**

#### Cost Calculation
```
Total Cost = (Total Kg × Fruit Price) + Commission
```

#### Revenue Calculation
```
Total Revenue = Sum of all calculated_price values from sales records
```

#### Profit/Loss Analysis
```
Profit/Loss = Total Revenue - Total Cost
Profit Margin % = (Profit/Loss ÷ Total Cost) × 100
```

#### Yield Analysis
```
Yield % = (Kg Processed ÷ Total Kg Received) × 100
Waste Kg = Waste products recorded during classification
Loss Kg = Shrinkage/loss during processing
```

## Architecture

### API Routes

#### `GET /api/batch-tracking`
Retrieves all batches with profitability summary
- Returns list of last 50 lots with calculated profit metrics
- Includes status (completado, en_proceso, iniciado)

**Response Example:**
```json
[
  {
    "id": 1,
    "lot_number": "LOTE-001",
    "producer": "Juan García",
    "fruit_type": "Guanabana",
    "date": "2024-01-15",
    "totalKg": 250.50,
    "cost": 5010.00,
    "revenue": 7515.00,
    "profit": 2505.00,
    "profitMargin": 50.01,
    "status": "completado"
  }
]
```

#### `GET /api/batch-tracking?lotId={lotId}`
Retrieves detailed tracking for a specific lot
- Includes complete journey with checkpoints
- Detailed cost/revenue breakdown
- All related transactions

**Response Includes:**
- Lot metadata
- 4 journey checkpoints with status
- Weighings, cutting orders, lotification data
- Sales records with individual line items
- Financial summary with detailed calculations

### React Hook: `useBatchTracking`

```javascript
import { useBatchTracking } from '@/hooks/useBatchTracking';

function Component() {
  const { 
    batches,              // Array of all batches
    selectedBatch,        // Currently viewed batch detail
    loading,              // Loading state
    error,                // Error message if any
    getBatchStats,        // Function returning summary stats
    refetch,              // Manual refresh function
    setSelectedBatch,     // Update selected batch
    sortBatchesByProfit,  // Sort helper
    sortBatchesByMargin   // Sort helper
  } = useBatchTracking(lotId);

  // Hook automatically fetches data on mount and when lotId changes
  // getBatchStats() returns:
  // {
  //   totalBatches,
  //   totalRevenue,
  //   totalCost,
  //   totalProfit,
  //   avgProfitMargin,
  //   profitableCount,
  //   lossCount,
  //   profitPerBatch
  // }
}
```

## User Interface Components

### 1. **Batch Tracking Page** (`/app/batch-tracking/page.jsx`)
Full-featured dashboard showing:
- Key metrics cards (total profit, margin %, etc.)
- Sortable batch list with visual profit indicators
- Detail view with complete journey and financial breakdown
- Sales transaction table

### 2. **Dashboard Panel** (`/components/batch-tracking-panel.jsx`)
Embedded summary on main dashboard showing:
- Top 5 most profitable batches
- Quick stats (net profit, avg margin, success rate)
- "View All" link to full page

### 3. **Batch Detail View**
Shows for each lot:
- **Lot Information**: Producer, origin, date, fruit type
- **Journey Timeline**: 4-stage process with completion indicators
- **Financial Summary**: Cost breakdown and profit calculation
- **Sales Details**: Transaction table with all sales records

## Data Flow

```
User Inputs Data
    ↓
[fruit-input] → weighings table
[cutting-orders] → cutting_orders table
[lotification] → lotification_records table
[sales-process-waste] → sales_of_process_and_waste table
    ↓
API /batch-tracking assembles data
    ↓
Calculates:
  - Total costs (fruit + commission)
  - Total revenue (from sales)
  - Profit/loss metrics
  - Yield percentages
    ↓
Returns to Frontend
    ↓
Display in useBatchTracking hook
    ↓
Render in Dashboard Panel & Full Page
```

## Key Calculations Explained

### Example Batch Calculation

**Scenario**: Lote-001 with 250kg guanabana @ ₡20/kg with ₡500 commission

**Input Costs:**
- Fruit Cost: 250kg × ₡20 = ₡5,000
- Commission: ₡500
- **Total Cost: ₡5,500**

**Processing Results:**
- Kg Processed: 225kg (90% yield)
- Kg Waste: 20kg
- Kg Loss: 5kg

**Sales Revenue:**
- Processed product: 225kg × ₡30 = ₡6,750
- Waste sale: 20kg × ₡10 = ₡200
- **Total Revenue: ₡6,950**

**Financial Result:**
- Profit = ₡6,950 - ₡5,500 = **₡1,450**
- Margin = (₡1,450 ÷ ₡5,500) × 100 = **26.36%**

## Integration Points

### With Other Modules

| Module | Integration | Data Flow |
|--------|-------------|-----------|
| Fruit Input | Weighings | Reads net weight for cost calculation |
| Cutting Orders | Batch journey | Shows boxes processed/returned |
| Lotification Registry | Classification | Reads caliber distribution |
| Sales Process & Waste | Revenue | Reads unit prices and quantities |
| Settings | Configuration | Uses fruit prices and commission amounts |

### Real-Time Updates

The batch tracking automatically reflects:
- New weighings (updates total kg and cost)
- New cutting orders (updates journey stage)
- New lotification records (updates processing data)
- New sales (updates revenue instantly)

No manual refresh needed due to sync manager integration.

## Status Indicators

Each batch displays one of three statuses:

| Status | Condition | Color |
|--------|-----------|-------|
| **Completado** | Has sales records | ✓ Green |
| **En Proceso** | Has cutting orders but no sales | ⏳ Blue |
| **Iniciado** | Has weighings only | ○ Gray |

## Performance Considerations

- **Query Optimization**: Uses LEFT JOINs for efficient aggregation
- **Caching**: Data fetched on component mount and on demand
- **Pagination**: Limits to 50 batches per request
- **Sorting**: Client-side sorting for large datasets

## Future Enhancements

Potential additions:
1. **Predictive Analytics**: ML model for profit forecasting
2. **Variance Analysis**: Compare actual vs expected yields
3. **Supplier Performance**: Correlate producer quality to profit margins
4. **Seasonal Trends**: Analyze profitability by season/time
5. **Export Reports**: PDF/Excel batch profitability reports
6. **Alerts**: Notifications for batches with poor margins

## Troubleshooting

### No Data Showing
- Verify weighings exist for the lot
- Check that sales records are linked to correct lot_id
- Ensure lot has been created with fruit_price > 0

### Incorrect Profit Calculations
- Verify fruit_price in lots table
- Check calculated_price vs total_price in sales records
- Confirm commission_amount is set correctly

### Slow Performance
- Check database indexes on lot_id foreign keys
- Limit date range in batch queries
- Clear browser cache and refetch

## Files Created

- `/app/api/batch-tracking/route.js` - API endpoints
- `/hooks/useBatchTracking.js` - React hook
- `/app/batch-tracking/page.jsx` - Full page view
- `/components/batch-tracking-panel.jsx` - Dashboard component

## Access Control

- All users can view batch tracking
- Data is aggregated from existing modules
- No special permissions required
- Super admin can configure base prices in settings
