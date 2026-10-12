# 🔧 Technical Integration: Batch Tracking Module

## System Architecture

```
Frontend Layer
├── /batch-tracking/page.jsx (Full dashboard)
├── /components/batch-tracking-panel.jsx (Dashboard widget)
└── /hooks/useBatchTracking.js (Data management)
        ↓
API Layer
└── /api/batch-tracking/route.js
        ↓
Database Layer
├── lots
├── weighings
├── cutting_orders
├── lotification_registry
├── lotification_records
└── sales_of_process_and_waste
```

## API Endpoint Specification

### GET `/api/batch-tracking`
**Purpose**: Retrieve all batches with profitability summary

**Query Parameters:**
- None for list view
- `?lotId={id}` for detailed view

**Response (List):**
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

**Response (Detail with lotId):**
```json
{
  "lot": {
    "id": 1,
    "lot_number": "LOTE-001",
    "producer": "Juan García",
    "origin": "Siquirres",
    "fruit_type": "Guanabana",
    "date": "2024-01-15",
    "fruit_price": 20.00,
    "collector_name": "Carlos",
    "commission_amount": 500.00
  },
  "checkpoints": [
    {
      "stage": "Ingreso",
      "description": "Fruta recibida en empacadora",
      "date": "2024-01-15",
      "metric": "250.50 kg",
      "status": "completado",
      "icon": "📦"
    },
    // ... 3 more checkpoints
  ],
  "weighings": [...],
  "cuttingOrders": [...],
  "lotificationRegistry": [...],
  "lotificationRecords": {...},
  "sales": [...],
  "summary": {
    "totalWeighingKg": 250.50,
    "totalKgProcessed": 225.00,
    "totalKgWaste": 20.00,
    "totalKgLoss": 5.50,
    "yieldPercentage": 90.00,
    "inputCost": 5010.00,
    "commissionCost": 500.00,
    "totalCost": 5510.00,
    "totalRevenue": 7515.00,
    "profit": 2005.00,
    "profitMargin": 36.39
  }
}
```

## Database Queries

### Query 1: Batch Summary (List View)
```sql
SELECT 
  l.id,
  l.lot_number,
  l.producer,
  l.fruit_type,
  l.date,
  l.fruit_price,
  l.commission_amount,
  COUNT(DISTINCT w.id) as weighing_count,
  SUM(w.net_weight) as total_kg_weighed,
  COUNT(DISTINCT co.id) as cutting_order_count,
  COUNT(DISTINCT spw.id) as sales_count
FROM lots l
LEFT JOIN weighings w ON l.id = w.lot_id
LEFT JOIN cutting_orders co ON l.id = co.lot_id
LEFT JOIN sales_of_process_and_waste spw ON l.id = spw.lot_id
GROUP BY l.id, l.lot_number, l.producer, l.fruit_type, l.date, l.fruit_price, l.commission_amount
ORDER BY l.date DESC
LIMIT 50
```

### Query 2: Batch Detail (Single Lot)
```sql
SELECT 
  id,
  boxes,
  gross_weight,
  net_weight,
  with_pallet,
  tare_weight,
  timestamp
FROM weighings 
WHERE lot_id = $1
ORDER BY timestamp ASC
```

Similar queries for:
- `cutting_orders` (by lot_id)
- `lotification_registry` (by lot_id)
- `lotification_records` (by lot_id)
- `sales_of_process_and_waste` (by lot_id)

## Calculation Logic

### Cost Calculation Function
```javascript
function calculateBatchCost(lot, totalKg) {
  const inputCost = totalKg * parseFloat(lot.fruit_price || 0);
  const commissionCost = parseFloat(lot.commission_amount || 0);
  return {
    inputCost,
    commissionCost,
    totalCost: inputCost + commissionCost
  };
}
```

### Revenue Calculation Function
```javascript
function calculateBatchRevenue(salesRecords) {
  return salesRecords.reduce((sum, sale) => {
    const saleAmount = parseFloat(sale.calculated_price) || 
                      parseFloat(sale.total_price) || 0;
    return sum + saleAmount;
  }, 0);
}
```

### Profit Calculation Function
```javascript
function calculateBatchProfit(totalRevenue, totalCost) {
  const profit = totalRevenue - totalCost;
  const profitMargin = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
  
  return {
    profit,
    profitMargin,
    status: profit >= 0 ? 'profitable' : 'loss'
  };
}
```

### Yield Calculation Function
```javascript
function calculateYield(totalKgReceived, totalKgProcessed) {
  if (totalKgReceived <= 0) return 0;
  return (totalKgProcessed / totalKgReceived) * 100;
}
```

## React Hook Implementation

### Hook Initialization
```javascript
export function useBatchTracking(lotId = null) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = async (specificLotId = null) => {
    const url = specificLotId 
      ? `/api/batch-tracking?lotId=${specificLotId}`
      : `/api/batch-tracking`;
    // ... fetch and state management
  };

  useEffect(() => {
    if (lotId) {
      fetchBatches(lotId);
    } else {
      fetchBatches();
    }
  }, [lotId]);
}
```

### Statistics Aggregation
```javascript
const getBatchStats = () => {
  const totalBatches = batches.length;
  const totalRevenue = batches.reduce((sum, b) => sum + (b.revenue || 0), 0);
  const totalCost = batches.reduce((sum, b) => sum + (b.cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const avgProfitMargin = batches.length > 0
    ? batches.reduce((sum, b) => sum + (b.profitMargin || 0), 0) / batches.length
    : 0;
  const profitableCount = batches.filter(b => b.profit > 0).length;
  const lossCount = batches.filter(b => b.profit < 0).length;

  return {
    totalBatches,
    totalRevenue,
    totalCost,
    totalProfit,
    avgProfitMargin,
    profitableCount,
    lossCount,
    profitPerBatch: totalBatches > 0 ? (totalProfit / totalBatches) : 0
  };
};
```

## Component Data Flow

### Batch Tracking Page
```
1. Page mounts
2. useBatchTracking() hook called
3. Fetches /api/batch-tracking
4. Sets batches state
5. Renders batch list or detail view
6. User clicks batch → setSelectedBatch()
7. Switch to detail view with journey timeline
```

### Dashboard Panel
```
1. Component mounts
2. useBatchTracking() hook called
3. Gets first 5 batches sorted by profit
4. Renders summary stats
5. Renders batch rows with progress bars
6. User can click "Ver todo" to go to full page
```

## Performance Optimizations

### Query Optimization
- Uses LEFT JOINs to avoid data duplication
- Groups by lot ID to reduce result set size
- Limits to 50 batches for initial load
- Indexed foreign keys (lot_id) for fast joins

### Frontend Optimization
- Memoized calculations in hook
- Client-side sorting for lists < 100 items
- Lazy loading of detail view
- Conditional rendering (hide until needed)

### Data Freshness
- Refetch on component mount
- Auto-sync when sales/weights updated (via sync-manager)
- Manual refresh button for user control
- No polling needed (event-driven)

## Integration with Existing Modules

### Fruit Input Module
- Provides: lot_number, producer, fruit_type, fruit_price, commission_amount
- Triggers: Initial batch creation
- Data flow: → lots table → batch-tracking aggregates

### Weighings Module
- Provides: net_weight, boxes, timestamp
- Triggers: When weight recorded in fruit-input
- Data flow: → weighings table → batch-tracking calculates cost

### Cutting Orders Module
- Provides: boxes_count, returned_boxes, missing_boxes, status
- Triggers: When cut orders created
- Data flow: → cutting_orders table → batch-tracking updates journey

### Lotification Module
- Provides: total_kg_processed, total_kg_waste, total_kg_loss
- Triggers: When classification recorded
- Data flow: → lotification_records table → batch-tracking calculates yield

### Sales Process & Waste Module
- Provides: calculated_price, process_kg, unit_price
- Triggers: When sales recorded
- Data flow: → sales_of_process_and_waste table → batch-tracking calculates revenue

### Settings Module
- Provides: Commission amounts (configured per user)
- Triggers: When batch created with commission
- Data flow: → lots.commission_amount → batch-tracking uses in cost calc

## Error Handling

### API Error Cases
```javascript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('API Error');
  const data = await response.json();
  // Process data
} catch (error) {
  setError(error.message);
  // Show error UI
}
```

### Missing Data Handling
- If no weighings: totalKg = 0, cost includes commission only
- If no sales: revenue = 0, shows loss
- If no lotification: yieldPercentage = 0
- All fields have defaults to prevent NaN

## Testing Scenarios

### Test Case 1: Complete Batch
1. Create lot with fruit_price > 0
2. Record weighing with net_weight > 0
3. Record cutting orders
4. Record lotification
5. Record sales
6. Verify profit calculation matches manual math

### Test Case 2: Partial Batch
1. Create lot
2. Record weighing only
3. Verify status = "iniciado"
4. Verify profit = negative (cost only)

### Test Case 3: High Waste
1. Create lot
2. Record weighing (100kg)
3. Record lotification (10kg processed, 80kg waste)
4. Record sales of waste
5. Verify waste revenue counted in total

### Test Case 4: Multiple Transactions
1. Create lot
2. Record multiple weighings (sum total)
3. Record multiple sales transactions
4. Verify all are summed correctly

## Database Schema Requirements

```sql
-- lots table must have:
ALTER TABLE lots ADD COLUMN IF NOT EXISTS fruit_price NUMERIC;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;

-- weighings table must have lot_id foreign key:
ALTER TABLE weighings ADD CONSTRAINT fk_weighings_lot_id 
  FOREIGN KEY (lot_id) REFERENCES lots(id);

-- cutting_orders table must have lot_id foreign key:
ALTER TABLE cutting_orders ADD CONSTRAINT fk_cutting_orders_lot_id 
  FOREIGN KEY (lot_id) REFERENCES lots(id);

-- All foreign keys should be indexed:
CREATE INDEX idx_weighings_lot_id ON weighings(lot_id);
CREATE INDEX idx_cutting_orders_lot_id ON cutting_orders(lot_id);
CREATE INDEX idx_lotification_records_lot_id ON lotification_records(lot_id);
CREATE INDEX idx_sales_lot_id ON sales_of_process_and_waste(lot_id);
```

## Future Enhancement Hooks

### For ML Integration
- Store predicted_profit in batches
- Track prediction accuracy
- Feed back actual results for model training

### For Report Generation
- Export profit data by date range
- Aggregate by producer
- Calculate seasonal trends
- Generate PDF reports

### For Real-Time Alerts
- Alert if margin drops below threshold
- Notify on unusually high waste
- Flag suspicious pricing

### For Mobile Sync
- Sync batch data to mobile app
- Show profit info in field
- Update weights from scale

## Deployment Considerations

### Environment Variables
- None required (uses existing db connection)
- Uses relative API URLs (no NEXT_PUBLIC_API_URL needed)

### Database Migration
- No migration needed (uses existing tables)
- Just add indexes for performance

### Backwards Compatibility
- Works with existing data immediately
- No schema changes required
- Safe to deploy alongside other modules

## Monitoring & Observability

### Metrics to Track
- Average batch profit margin
- % of batches with positive ROI
- Processing time per batch
- Yield % by producer
- Revenue per kg processed

### Logs to Monitor
- API response times for batch-tracking
- Database query performance
- Calculation errors
- Data sync issues

### Health Checks
```javascript
// In API route:
if (!lot || !lot.fruit_price) {
  console.warn(`Batch ${lotId} missing fruit_price`);
}
if (totalKg <= 0) {
  console.warn(`Batch ${lotId} has zero weight`);
}
```
