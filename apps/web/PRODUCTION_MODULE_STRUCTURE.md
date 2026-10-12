# Production Module - 4-Section Structure

## Overview
The production module has been completely restructured into 4 integrated sections with real-time inventory synchronization and automated kit generation.

---

## 🏗️ Section 1: Pallet Configuration (Top)
**Location**: Top of the page
**Purpose**: Configure pallet specifications

**Configurable Fields**:
- **Peso de Tarima (kg)**: Weight of each pallet (default: 22 kg)
- **Peso por Caja (kg)**: Weight per box (default: 2 kg)
- **Cajas por Tarima**: Number of boxes per pallet (default: 50)

**Features**:
- Real-time configuration updates
- Values saved to `system_settings` table
- Automatic pallet calculations for kit generation

**API**: `/api/production/pallet-config` (GET/PUT)

---

## 📊 Section 2: Inventory Status (Dashboard View)
**Location**: Three-column display below pallet configuration
**Purpose**: Real-time inventory monitoring

### Sub-sections:

#### A. Material Stock Inventory (Left Column - 2/3 width)
- Table displaying all materials in inventory
- Columns:
  - Material name
  - Category
  - Quantity available
  - Stock status (✓ Ok / ⚠️ Bajo)
- Shows first 8 materials with "and X more..." indicator
- Stock status badges:
  - 🟢 **Ok**: Above minimum stock level
  - 🟡 **Low**: Below minimum stock level

**Data Source**: `materials_inventory` table

#### B. Field Box Inventory (Right Column - 1/3 width)
- Displays total available field boxes
- Large, prominent number display
- Blue gradient card styling
- Auto-updates when kits are generated
- Shows note: "Se actualizan automáticamente al generar kits"

**Data Source**: `box_control` table (sum of `boxes_returned`)

**API**: `/api/production/inventory-status` (GET)

---

## ⚙️ Section 3: Automated Kit Generation System
**Location**: Center section
**Purpose**: Generate production kits with real-time material deduction

### Layout: 3-Column Grid

#### Left Column: Lot Selection
- **Dropdown**: Select lot from available lots (status = 'selection')
- **Lot Details Box** (appears when lot selected):
  - Productor (Producer name)
  - Huerta (Orchard name)
  - Total Kg (from weighings table)
  - Origin
- **Production Date**: Date picker (defaults to today)

#### Center Column: Materials Selection
- **Scrollable list** of all materials from inventory
- For each material:
  - Material name (bold)
  - Available quantity
  - Input field for quantity to use
  - Unit display
- Max height with scroll for overflow

#### Right Column: Output & Calculations
- **Cajas Empacadas** (Packed Boxes): Number input
- **Cajas de Campo a Devolver** (Field Boxes to Return): Number input
  - Auto-adds returned boxes to field box inventory
- **Auto-calculation Box**:
  - Shows number of pallets needed
  - Shows total tonnage
  - Recalculates as you change packed boxes count
- **Generate Kit Button**: Full width, prominent blue button

### Functionality:

**When "Generar Kit" is clicked**:
1. Validates lot selection and packed boxes count
2. Creates production batch in `production_batches` table
3. **Real-time Material Deduction**:
   - For each selected material, deduct quantity from `materials_inventory`
   - Record deduction in `material_deductions` table
4. **Field Box Return** (if specified):
   - Adds returned field boxes to field box inventory
   - Updates can be tracked in `box_control`
5. **Sync Confirmation**:
   - Success message: "✅ Kit generado exitosamente - Materiales deducidos en tiempo real"
   - Reloads all inventory data automatically
   - Clears form for next kit

**Error Handling**:
- Validates lot selection required
- Validates packed boxes is valid number > 0
- Checks material quantity availability
- Shows error messages in red banner

**API**: `/api/production/kit-generation` (POST)

---

## 📋 Section 4: Batch Selection & Logs (Bottom)
**Location**: Bottom of page
**Purpose**: Display and track all production batches with kg amounts

### Display Format
**4-Column Grid Layout** (responsive):
- On mobile: 1 column
- On tablet: 2 columns  
- On desktop: 4 columns

### Card Content (per batch):
Each card shows:
- **Lot Reference**: "Lote #{lot_number}"
- **Producer**: Prominent name display
- **Packed Boxes**: "📦 Cajas: [COUNT]"
- **Production Date**: "📅 Fecha: [DATE]" (formatted as es-MX locale)
- **Status**: "🏷️ Estado: [STATUS]"
  - Yellow text if "In Progress"
  - Green text if "Completed"

### Card Styling:
- Light gray background (slate-50)
- Hover effect: Border changes to brand-300, background to brand-50/30
- Rounded corners and subtle borders
- Responsive and stackable

**Data Source**: Fetches from `/api/production` GET endpoint
- Shows all production batches ordered by creation date
- Includes linked lot information (lot_number, producer, packed_boxes_count, production_date, status)

**Empty State**: "No hay registros de producción aún" with centered text

---

## 🔄 Real-Time Synchronization

### When Kit is Generated:
1. ✅ Material quantities deducted from `materials_inventory`
2. ✅ Deductions recorded in `material_deductions` table
3. ✅ Field boxes added to inventory (if specified)
4. ✅ Production batch created in `production_batches`
5. ✅ All inventory section data reloads
6. ✅ New batch appears in batch logs section

### Data Refresh Timing:
- **On Kit Generation**: Automatic reload of all data
- **Pallet Config**: Saved immediately on change
- **Manual Refresh**: Page reload picks up any external changes

---

## 📊 Database Tables Used

| Table | Purpose |
|-------|---------|
| `lots` | Source lots for production |
| `weighings` | Total kg per lot (via net_weight sum) |
| `production_batches` | Records each production kit generated |
| `materials_inventory` | Current material stock (quantity_available) |
| `material_deductions` | Log of materials used per batch |
| `box_control` | Field box tracking (boxes_returned) |
| `system_settings` | Pallet configuration storage |

---

## 🔌 API Routes Created

### `/api/production/pallet-config`
- **GET**: Fetch current pallet configuration
- **PUT**: Update pallet configuration
- **Stores in**: `system_settings` table

### `/api/production/batch-summary`
- **GET**: Fetch available lots with total kg
- **Filters**: Only lots with status = 'selection'
- **Returns**: lot_id, lot_number, producer, origin, orchard_name, total_kg

### `/api/production/inventory-status`
- **GET**: Fetch all materials + field box inventory
- **Filters**: Optional category filter
- **Returns**: material inventory + field box count

### `/api/production/kit-generation`
- **POST**: Generate kit with material deduction
- **Input**: lot_id, materials_used[], packed_boxes_count, field_boxes_returned, production_date
- **Actions**: Creates batch, deducts materials, returns field boxes
- **Returns**: Success message + batch data

### `/api/production` (existing)
- **GET**: Fetch all production batches with lot info
- **POST**: Create production batch (used by kit-generation)
- **PUT**: Update batch status

---

## 🎨 UI/UX Features

✅ **Color Coding**:
- 🟢 Green: Ok stock status
- 🟡 Yellow: Low stock warning
- 🔵 Blue: Field box inventory
- 🔴 Red: Error messages
- 🟣 Brand colors: Primary actions

✅ **Icons & Emojis**:
- 📦 Pallet Configuration
- 📊 Inventory Status
- ⚙️ Kit Generation
- 📋 Production Logs
- 🔲 Field Boxes
- 💡 Auto-calculations

✅ **Responsive Design**:
- Mobile-first approach
- Grid layouts adapt to screen size
- Scrollable inventory lists
- Touch-friendly inputs

✅ **Real-Time Feedback**:
- Success message on kit generation
- Error messages with details
- Loading state on button
- Auto-close success messages after 3 seconds

---

## 🚀 Usage Workflow

1. **Start**: Access Production module
2. **Section 1**: Review/adjust pallet configuration if needed
3. **Section 2**: Check current material inventory and field boxes
4. **Section 3**: 
   - Select a lot from dropdown
   - Review lot details (producer, kg, etc)
   - Select materials to use
   - Enter packed boxes count
   - Enter field boxes to return (optional)
   - Click "Generar Kit"
5. **Section 4**: New batch appears in logs
6. **Verification**: Material quantities updated automatically

---

## ✨ Key Improvements Over Previous Version

- ✅ Better organization with 4 distinct sections
- ✅ Real-time inventory synchronization
- ✅ Automatic material deduction on kit generation
- ✅ Field box inventory management
- ✅ Configurable pallet parameters
- ✅ 4-column batch log layout for better visibility
- ✅ Total kg display from weighings per lot
- ✅ Auto-calculation of pallets and tonnage
- ✅ Visual status indicators
- ✅ Responsive grid layouts
