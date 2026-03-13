# JABA BATCH PRODUCTION - COMPLETE WORKFLOW GUIDE

## 📋 STEP-BY-STEP BATCH PRODUCTION WORKFLOW

This document explains the complete flow from batch creation to distribution.

---

## **STEP 1: CREATE BATCH** (`/jaba/batches/add`)

**Purpose:** Plan and create a new production batch

**What You Do:**
1. Go to **Batch Production** page
2. Click **"Add Batch"** button
3. Fill in the batch creation form:

**Required Fields:**
- ✅ **Batch Number** - Auto-generated (e.g., BCH-2025-00001)
- ✅ **Production Date** - When batch will be produced
- ✅ **Flavor** - Select from list or add new flavor
- ✅ **Expected Production Volume (Litres)** - How much you plan to produce
- ✅ **Tank Number** - Where the batch will be stored (e.g., TANK-001)
- ✅ **Supervisor Name** - Who's supervising production
- ✅ **Shift** - Morning / Afternoon / Night
- ✅ **Raw Materials** - Select materials and quantities needed

**What Happens:**
- Batch is created with status: **"Processing"**
- **Raw materials are IMMEDIATELY deducted from inventory** (happens on creation)
- Inventory movements are logged for audit trail
- Batch appears in the batches list

**Status After Creation:** `Processing`

**Important:** 
- Materials are deducted from inventory immediately when batch is created
- If stock is insufficient, batch creation is blocked with clear error message
- All inventory changes are logged for audit purposes

---

## **STEP 2: MARK AS PROCESSED** (From Batches List)

**Purpose:** Record actual production output after manufacturing

**What You Do:**
1. Find your batch in the list (status: "Processing")
2. Click the **"Processed"** button (green status badge)
3. Fill in the dialog:

**Required Fields:**
- ✅ **Production Date** - Actual production date
- ✅ **Actual Produced Volume (Litres)** - How much was actually produced
- ✅ **Supervisor Name** - Production supervisor
- ⚠️ **Reason for Variance** - Only if actual differs from expected

**What Happens:**
- Batch status changes to: **"Processed"**
- **Batch becomes LOCKED** - no further edits allowed
- Actual volume is recorded
- If volume differs from expected, variance reason is saved
- Batch is ready for next step

**Status After Processing:** `Processed`

**Important Locking Rules:**
- Once a batch is marked as "Processed", it becomes **LOCKED**
- **Cannot edit** any fields: materials, volumes, dates, product, supervisor, etc.
- Edit button is disabled in UI
- Backend rejects any edit attempts with 403 error
- Tank number was already set during batch creation, so it's not asked here.

**Note:** Materials were already deducted when batch was created, not when processed.

---

## **STEP 3A: QUALITY CONTROL (OPTIONAL)** (`/jaba/qc/checklist`)

**Purpose:** Perform quality checks on the batch

**When to Use:**
- ✅ **Option 1:** Go to QC if quality check is required
- ✅ **Option 2:** Skip QC and go directly to Packaging (if not needed)

**What You Do (If QC is Required):**
1. Find batch with status: **"Processed"** or **"QC Pending"**
2. Click the **"QC"** button (solid green button)
3. Complete the QC checklist
4. Mark as **"Pass"** or **"Fail"**

**What Happens:**
- If **Pass:** Status changes to **"QC Passed - Ready for Packaging"**
- If **Fail:** Status changes to **"QC Failed"**

**Status After QC Pass:** `QC Passed - Ready for Packaging`

**Status After QC Fail:** `QC Failed`

**Alternative:** You can skip QC and go directly to Packaging if batch status is "Processed"

---

## **STEP 3B: SKIP QC (OPTIONAL)**

**Purpose:** Go directly to packaging without QC

**When to Use:**
- When QC is not required for this batch
- When you want to speed up the process

**What You Do:**
1. Find batch with status: **"Processed"**
2. Click the **"Packaging"** button directly
3. Proceed to packaging

**Status:** Remains `Processed` (can still do QC later if needed)

---

## **STEP 4: PACKAGING** (`/jaba/packaging-output/add`)

**Purpose:** Convert liquid into packaged bottles

**When Available:**
- Batch status: **"Processed"** (skipped QC)
- Batch status: **"QC Passed - Ready for Packaging"** (passed QC)
- Batch status: **"Partially Packaged"** (has remaining volume)

**What You Do:**
1. Find your batch in the list
2. Click the **"Packaging"** button (solid green button)
3. Fill in packaging form:

**Required Fields:**
- ✅ **Batch** - Selected automatically
- ✅ **Volume Allocated** - How much to package (litres)
- ✅ **Packaging Date**
- ✅ **Packaging Line Number**
- ✅ **Supervisor**
- ✅ **Team Members**
- ✅ **Container Types & Quantities** (500ml, 1L, 2L, custom)
- ✅ **Defects/Rejected bottles** (if any)
- ✅ **Machine Efficiency**
- ✅ **Safety Checks**

**What Happens:**
- Bottles are created (500ml, 1L, 2L)
- Remaining litres are tracked
- If all volume packaged: Status → **"Ready for Distribution"**
- If partial packaging: Status → **"Partially Packaged"**

**Status After Full Packaging:** `Ready for Distribution`

**Status After Partial Packaging:** `Partially Packaged`

---

## **STEP 5: DISTRIBUTION** (`/jaba/distribution/create`)

**Purpose:** Create delivery notes and distribute products

**When Available:**
- Batch status: **"Ready for Distribution"**
- Batch status: **"Partially Packaged"** (has packaged items)

**What You Do:**
1. Find your batch in the list
2. Click the **"Distribution"** button (outline green button)
3. Fill in distribution form:

**Required Fields:**
- ✅ **Distributor** - Select customer/distributor
- ✅ **Batch** - Selected automatically
- ✅ **Items** - Select quantities per size (500ml, 1L, 2L)
- ✅ **Vehicle/Driver**
- ✅ **Delivery Location**
- ✅ **Notes**

**What Happens:**
- Delivery note is created
- Products are dispatched
- Batch tracking is complete

**Status:** `Completed` (after distribution)

---

## 🔄 COMPLETE WORKFLOW VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: CREATE BATCH                                       │
│ Status: "Processing"                                        │
│ Fields: Batch#, Date, Flavor, Expected Volume, Tank#, etc.  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: MARK AS PROCESSED                                   │
│ Status: "Processed"                                         │
│ Fields: Actual Volume, Supervisor, Variance Reason (if any)│
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌───────────────┐          ┌──────────────────────┐
│ STEP 3A: QC   │          │ STEP 3B: SKIP QC     │
│ (Optional)    │          │ (Optional)           │
│               │          │                      │
│ Status:       │          │ Status: "Processed"  │
│ "QC Passed -  │          │                      │
│ Ready for     │          │                      │
│ Packaging"    │          │                      │
└───────┬───────┘          └──────────┬───────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: PACKAGING                                           │
│ Status: "Ready for Distribution" or "Partially Packaged"    │
│ Fields: Volume, Containers, Team, Defects, Efficiency      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: DISTRIBUTION                                        │
│ Status: "Completed"                                         │
│ Fields: Distributor, Items, Vehicle, Location               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 STATUS FLOW DIAGRAM

```
Processing
    │
    ▼
Processed ──┬──> QC Pending ──> QC Passed - Ready for Packaging
            │
            └──> (Skip QC) ──> Processed ──> Packaging
                                    │
                                    ▼
                        Ready for Distribution
                                    │
                                    ▼
                              Completed
```

---

## 🎯 KEY FEATURES

### **1. Tank Number at Creation**
- ✅ Tank number is set **when creating the batch**
- ✅ Not asked again when marking as processed
- ✅ Helps plan storage from the start

### **2. QC is Optional**
- ✅ Can skip QC and go directly to Packaging
- ✅ Can do QC later if needed (from Edit page)
- ✅ Admin can edit batch to go to QC anytime

### **3. Flexible Workflow**
- ✅ Process batches in any order that makes sense
- ✅ Can package partially and come back later
- ✅ Track remaining volume at each step

### **4. Clear Status Indicators**
- ✅ Each status shows what action is available
- ✅ Buttons appear based on current status
- ✅ Visual hierarchy: Primary actions (solid green), Secondary (outline green)

---

## 💡 COMMON SCENARIOS

### **Scenario 1: Standard Flow (With QC)**
1. Create Batch → `Processing`
2. Mark as Processed → `Processed`
3. Go to QC → `QC Passed - Ready for Packaging`
4. Packaging → `Ready for Distribution`
5. Distribution → `Completed`

### **Scenario 2: Fast Track (Skip QC)**
1. Create Batch → `Processing`
2. Mark as Processed → `Processed`
3. Packaging (skip QC) → `Ready for Distribution`
4. Distribution → `Completed`

### **Scenario 3: Partial Packaging**
1. Create Batch → `Processing`
2. Mark as Processed → `Processed`
3. Packaging (100L of 200L) → `Partially Packaged`
4. Packaging again (remaining 100L) → `Ready for Distribution`
5. Distribution → `Completed`

### **Scenario 4: QC Failed**
1. Create Batch → `Processing`
2. Mark as Processed → `Processed`
3. Go to QC → `QC Failed`
4. Fix issues, edit batch, retry QC → `QC Passed - Ready for Packaging`
5. Continue with Packaging...

---

## 🔧 ADMIN FEATURES

### **Edit Batch** (Only if NOT Processed)
- Go to batch details page
- Click "Edit" button (only available if batch is NOT "Processed")
- Can change any field:
  - Production date
  - Flavor
  - Expected volume
  - Tank number
  - Supervisor
  - Shift
  - Raw materials (quantities, add/remove)
- **Material Adjustments:**
  - If you increase material quantity → additional amount is deducted from inventory
  - If you decrease material quantity → difference is refunded to inventory
  - If you remove a material → full quantity is refunded to inventory
  - If you add a new material → full quantity is deducted from inventory
- All inventory adjustments are logged for audit

### **Locked Batches (Processed)**
- Once batch status becomes "Processed", batch is **LOCKED**
- Edit button is disabled (shows lock icon)
- Cannot edit:
  - Raw materials
  - Volumes
  - Product/Flavor
  - Dates
  - Supervisor
  - Any field
- Backend rejects edit attempts with error: "Cannot edit a processed batch"

### **View Batch Details**
- See complete batch information
- Track all status changes
- View packaging history
- See distribution records
- View inventory movement history

---

## 📦 INVENTORY MANAGEMENT

### **Material Deduction Rules**

#### **On Batch Creation:**
- ✅ Materials are **deducted IMMEDIATELY** when batch is created
- ✅ Stock is validated BEFORE batch creation
- ✅ If insufficient stock → batch creation is blocked with clear error
- ✅ Inventory movement is logged: `type: DEDUCTION, reason: BATCH_CREATED`

#### **On Batch Edit (Before Processing):**
- ✅ Can edit materials freely (batch not locked yet)
- ✅ Material changes trigger automatic inventory adjustments:
  - **Increase quantity** → Additional amount deducted
  - **Decrease quantity** → Difference refunded
  - **Remove material** → Full quantity refunded
  - **Add material** → Full quantity deducted
- ✅ Stock validation before applying changes
- ✅ Inventory movements logged: `type: DEDUCTION/ADJUSTMENT, reason: BATCH_EDITED`

#### **After Processing (Locked):**
- ❌ Cannot edit materials (batch is locked)
- ❌ No inventory changes allowed
- ✅ Materials remain deducted (already used)

#### **On Batch Deletion:**
- ✅ All materials are restored to inventory
- ✅ Inventory movements logged for audit

### **Inventory Movement Tracking**
- All material deductions and adjustments are logged in `jaba_inventory_movements` collection
- Each movement includes:
  - Type: `DEDUCTION` or `ADJUSTMENT`
  - Reason: `BATCH_CREATED` or `BATCH_EDITED`
  - Batch ID and batch number
  - Material ID and name
  - Quantity and unit
  - Before/after stock levels
  - Timestamp and user

---

## ❓ FAQ

**Q: Can I skip QC?**
A: Yes! If batch status is "Processed", you can go directly to Packaging.

**Q: When is tank number set?**
A: Tank number is set when creating the batch, not when processing.

**Q: Can I do QC later?**
A: Yes! Edit the batch and change status to "QC Pending" or go to QC page directly.

**Q: What if I package only part of the batch?**
A: Status becomes "Partially Packaged". You can package the remaining volume later.

**Q: Can I change batch status manually?**
A: Yes, through the Edit page. Admin can set any status.

---

## ✅ SUMMARY

1. **Create Batch** → Set tank number, expected volume, materials
2. **Mark as Processed** → Record actual production volume
3. **QC (Optional)** → Quality check if needed, or skip
4. **Packaging** → Convert liquid to bottles
5. **Distribution** → Deliver to customers

**Remember:** QC is optional! You can skip it and go directly to Packaging if not needed.

