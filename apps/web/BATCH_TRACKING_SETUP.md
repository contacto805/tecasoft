# 🚀 Quick Start: Batch Tracking Module

## What's New?

A complete **AI-powered batch tracking system** that automatically traces every lot from field to warehouse and calculates profit/loss in real-time.

## Getting Started (3 Steps)

### Step 1: Create Your First Lot
Go to **Ingreso de Fruta** and create a lot with:
- Lot number (auto-generated)
- Producer name
- Fruit type
- **Fruit price** (e.g., ₡20/kg)
- Commission amount (if applicable)

### Step 2: Register Weighings
In the same module, record the weight when fruit arrives at your facility:
- Boxes received
- Gross weight
- Tare weight
- Net weight is calculated automatically

### Step 3: View Tracking
Go to **Trazabilidad** (Batch Tracking) in the main navigation to see:
- Profitability dashboard
- Detailed batch journey
- Financial breakdown
- Sales records

## How It Works

### The 4-Stage Journey

Each lot automatically moves through 4 tracked stages:

1. **📦 Ingreso (Intake)**
   - Fruit arrives at facility
   - Weight is recorded
   - Cost is calculated (kg × price)

2. **✂️ Corte (Cutting)**
   - Boxes are processed
   - Returned boxes tracked
   - Missing boxes recorded

3. **📊 Clasificación (Classification)**
   - Fruit sorted by caliber
   - Processed kg recorded
   - Waste and loss tracked

4. **💰 Venta (Sales)**
   - Products are sold
   - Revenue recorded
   - Profit/loss calculated

### Real-Time Profit Calculation

```
Profit = Total Revenue - Total Cost

Total Cost = (Total Kg × Fruit Price) + Commission
Total Revenue = Sum of all sales prices
```

## Dashboard Overview

### Main Panel (Dashboard Home)
- Shows top 5 most profitable batches
- Summary stats: net profit, margin %, success rate
- Click "Ver todo" to see full list

### Full Trazabilidad Page (`/batch-tracking`)
- All batches with sort options
- Detailed financial breakdown for each batch
- Complete journey timeline
- Sales transaction records

## Key Metrics Explained

| Metric | What It Means | Example |
|--------|---------------|---------|
| **Ganancia Neta** | Total profit after all costs | +₡1,450 |
| **Margen de Ganancia %** | Profit as % of cost | 26.4% |
| **Rendimiento %** | What % of fruit became sellable product | 90% |
| **Cajas en Campo** | Boxes in process/transit | 45 cajas |
| **Kg Procesados** | Final product weight | 225 kg |

## Using the Interface

### Batch List View
Each batch card shows:
- Lot number and producer
- Status (Completado/En Proceso/Iniciado)
- Key numbers: kg, cost, revenue, profit
- Profit margin as visual bar
- Click to see full details

### Batch Detail View
When you click a batch, you see:
- Complete lot information
- 4-stage journey timeline (✓ or ○ for each stage)
- Cost breakdown (fruit cost + commission)
- Revenue sources (all sales)
- Sales transaction table

### Sorting Options
- **Mayor Ganancia**: Most to least profitable
- **Mayor Margen %**: Best to worst margins
- **Más Reciente**: Newest first

### Status Filtering
- **Todos**: All batches
- **Completados**: Fully processed and sold
- **En Proceso**: Being cut/processed
- **Iniciados**: Just arrived

## Data Integration

The system automatically pulls from:

| Module | Data Used |
|--------|-----------|
| Ingreso de Fruta | Fruit price, initial weight |
| Pesadas | Net weight for cost calculation |
| Órdenes de Corte | Boxes out, returned, missing |
| Lotificación | Caliber breakdown |
| Venta Proceso/Merma | Sales prices and quantities |
| Configuración | Commission amounts |

**No manual data entry required!** Everything syncs automatically.

## Common Scenarios

### Scenario 1: Track a Single Batch
1. Go to **Trazabilidad**
2. Find your batch by number
3. Click to see full journey and profit
4. View which sales generated revenue

### Scenario 2: Analyze Best/Worst Performers
1. Go to **Trazabilidad** 
2. Sort by "Mayor Ganancia" to see best
3. Check what made them profitable
4. Learn from high-margin batches

### Scenario 3: Debug Low Profitability
1. Click on batch with poor margin
2. Check the cost breakdown (is price too high?)
3. Look at yield % (waste too much?)
4. Review sales prices (pricing too low?)

## Helpful Tips

✅ **Batch names should be descriptive**
- Good: `LOTE-20240115-GUANABANA-JUAN`
- Avoid: `LOTE1`, `BATCH001`

✅ **Set accurate fruit prices**
- This directly affects profit calculations
- Update from procurement team
- Check prices monthly for seasonal changes

✅ **Record weights immediately**
- Don't batch data entry
- Ensures accuracy
- Allows real-time tracking

✅ **Track waste and loss**
- Lotificación module: record % waste
- Helps identify quality issues
- Affects yield calculations

## Troubleshooting

**Q: Why doesn't my batch show profit?**
A: Check if you have sales records. Revenue comes from "Venta Proceso/Merma" module. If none exist, profit will be negative (showing costs only).

**Q: Profit seems wrong?**
A: Verify:
1. Fruit price is set in Ingreso de Fruta
2. Commission amount is correct in lot creation
3. Sales are linked to the correct lot
4. Weights are recorded accurately

**Q: I don't see my new batch in Trazabilidad?**
A: The batch needs at least:
- A weighing record (to have a weight)
- A fruit price (from lot creation)

It will auto-appear in the list once these exist.

## Next Steps

1. **Create 5-10 sample lots** and process them fully
2. **Review the Summary Stats** to understand profit drivers
3. **Sort by margin %** to see your most efficient processes
4. **Export profits by producer** (future feature)
5. **Set profit targets** for seasonal planning

## Files Structure

- **Page**: `/batch-tracking` - Full dashboard page
- **Component**: `batch-tracking-panel` - Summary on home dashboard
- **Hook**: `useBatchTracking` - Data fetching and calculations
- **API**: `/api/batch-tracking` - Backend calculations
- **Docs**: This file + `BATCH_TRACKING_FEATURE.md`

## Questions?

The batch tracking module uses your existing data - nothing new to set up! It automatically:
- Aggregates data from 5 modules
- Calculates costs from fruit prices
- Computes revenue from sales records
- Derives profit in real-time
- Updates instantly when any data changes

Just start using your system normally, and profitability analysis happens automatically.
