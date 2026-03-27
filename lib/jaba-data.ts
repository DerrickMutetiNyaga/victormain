// ============================================
// DUMMY DATA FOR JABA MANUFACTURING PLANT SYSTEM
// ============================================

export interface Batch {
  id: string
  batchNumber: string
  date: Date
  flavor: string
  productCategory: string
  totalLitres: number
  bottles500ml: number
  bottles1L: number
  bottles2L: number
  status: "Processing" | "QC Pending" | "Completed" | "Ready for Distribution"
  qcStatus: "Pending" | "Pass" | "Fail" | "In Progress"
  supervisor: string
  shift: "Morning" | "Afternoon" | "Night"
  productionStartTime?: Date
  productionEndTime?: Date
  mixingDuration?: number
  processingHours?: number
  expectedLoss?: number
  actualLoss?: number
  temperature?: number
  ingredients: { material: string; quantity: number; unit: string; unitCost: number; totalCost: number; lotNumber?: string; supplier?: string }[]
  documents?: string[]
  packagingTeam?: string[]
  packagingTime?: Date
  outputSummary: {
    totalBottles: number
    remainingLitres: number
    breakdown: { size: string; quantity: number; litres: number }[]
  }
}

export interface Distributor {
  id: string
  name: string
  type: "External Supplier" | "Internal Distributor"
  category: "Liquor" | "Raw Material" | "Distributor"
  contactPerson: string
  phone: string
  email: string
  address: string
  itemsSupplied: string[]
  notes?: string
  region?: string
  volumeMonthly?: number
  deliveryFrequency?: string
}

export interface DeliveryNote {
  id: string
  noteId: string
  batchId: string
  batchNumber: string
  distributorId: string
  distributorName: string
  date: Date
  items: {
    size: "500ml" | "1L" | "2L"
    quantity: number
  }[]
  vehicle?: string
  driver?: string
  notes?: string
  status: "Pending" | "In Transit" | "Delivered"
  deliveryLocation?: string
  timeOut?: Date
  timeDelivered?: Date
  verificationStatus?: "Pending" | "Verified" | "Rejected"
}

export interface RawMaterial {
  id: string
  name: string
  category: string
  currentStock: number
  unit: string
  minStock: number
  supplier: string
  lastRestocked?: Date
  reorderLevel: number
  preferredSupplier?: string
}

export interface MaterialUsageLog {
  id: string
  materialId: string
  materialName: string
  batchId: string
  batchNumber: string
  quantityUsed: number
  unit: string
  remainingStock: number
  date: Date
  approvedBy: string
}

export interface QCResult {
  id: string
  batchId: string
  batchNumber: string
  inspector: string
  status: "Pass" | "Fail" | "Pending"
  date: Date
  checklist: {
    item: string
    result: "Pass" | "Fail" | "Pending"
    notes?: string
  }[]
  notes?: string
}

export interface ProductionOutput {
  id: string
  batchId: string
  batchNumber: string
  date: Date
  flavor: string
  productCategory: string
  totalLitres: number
  shift: "Morning" | "Afternoon" | "Night"
  supervisor: string
  tankNumber: string
  processingDuration?: number
  actualLoss?: number
  lossType?: "litres" | "percentage"
  certifiedBy: string
  status: "Stored" | "Sent for Packaging" | "Awaiting QC"
  qcStatus: "Pending" | "Pass" | "Fail"
}

export interface PackagingSession {
  id: string
  sessionId: string
  batchId: string
  batchNumber: string
  date: Date
  totalLitresUsed: number
  output500ml: number
  output1L: number
  output2L: number
  otherSizes?: { size: string; quantity: number }[]
  packagingLine: string
  supervisor: string
  teamMembers: string[]
  defects: number
  defectReasons?: string
  machineEfficiency: number
  efficiency: number
  status: "Pending" | "In Progress" | "Completed"
  packagingSessionSource?: string
}

export interface PackagingOutput {
  id: string
  batchId: string
  batchNumber: string
  size: "500ml" | "1L" | "2L" | string
  quantity: number
  packagingLine: string
  workers: string[]
  startTime: Date
  endTime: Date
  timeTaken: number // minutes
  defects: number
  efficiency: number // percentage
}

export interface FinishedGood {
  id: string
  productType: string
  flavor: string
  size: "500ml" | "1L" | "2L"
  quantity: number
  batches: string[]
  storageLocation: string
  lastUpdated: Date
}

export interface StockMovement {
  id: string
  type: "IN" | "OUT" | "ADJUSTMENT" | "LOSS"
  productType?: string
  materialId?: string
  materialName?: string
  batchId?: string
  batchNumber?: string
  quantity: number
  unit: string
  reason: string
  date: Date
  user: string
  notes?: string
}

// Flavors/Product Types
export const flavors = [
  "Honey Infused Whiskey",
  "Herb Infused Gin",
  "Spiced Rum Blend",
  "Citrus Vodka Fusion",
  "Vanilla Bourbon",
  "Cinnamon Apple Rum",
  "Lavender Gin",
  "Mint Mojito Vodka",
  "Peach Whiskey",
  "Ginger Beer Spirit",
  "Coffee Liqueur",
  "Chocolate Rum",
]

export const productCategories = ["Jaba", "Infusions", "Liquor Extracts", "Specialty Blends"]

// Raw Materials
export const rawMaterials: RawMaterial[] = [
  { id: "rm001", name: "Premium Whiskey Base", category: "Base Spirit", currentStock: 450, unit: "litres", minStock: 100, reorderLevel: 100, supplier: "Premium Spirits Ltd", lastRestocked: new Date("2024-11-15"), preferredSupplier: "Premium Spirits Ltd" },
  { id: "rm002", name: "Organic Honey", category: "Flavoring", currentStock: 120, unit: "kg", minStock: 30, reorderLevel: 30, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-20"), preferredSupplier: "Natural Ingredients Co" },
  { id: "rm003", name: "Fresh Herbs Mix", category: "Flavoring", currentStock: 85, unit: "kg", minStock: 20, reorderLevel: 20, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-18"), preferredSupplier: "Herb Suppliers Ltd" },
  { id: "rm004", name: "Citrus Extract", category: "Flavoring", currentStock: 95, unit: "litres", minStock: 25, reorderLevel: 25, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-22"), preferredSupplier: "Natural Ingredients Co" },
  { id: "rm005", name: "Vanilla Beans", category: "Flavoring", currentStock: 45, unit: "kg", minStock: 10, reorderLevel: 10, supplier: "Spice Importers", lastRestocked: new Date("2024-11-10"), preferredSupplier: "Spice Importers" },
  { id: "rm006", name: "Cinnamon Sticks", category: "Flavoring", currentStock: 60, unit: "kg", minStock: 15, reorderLevel: 15, supplier: "Spice Importers", lastRestocked: new Date("2024-11-12"), preferredSupplier: "Spice Importers" },
  { id: "rm007", name: "Lavender Flowers", category: "Flavoring", currentStock: 35, unit: "kg", minStock: 8, reorderLevel: 8, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-08"), preferredSupplier: "Herb Suppliers Ltd" },
  { id: "rm008", name: "Fresh Mint", category: "Flavoring", currentStock: 50, unit: "kg", minStock: 12, reorderLevel: 12, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-14"), preferredSupplier: "Herb Suppliers Ltd" },
  { id: "rm009", name: "Peach Extract", category: "Flavoring", currentStock: 70, unit: "litres", minStock: 18, reorderLevel: 18, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-16"), preferredSupplier: "Natural Ingredients Co" },
  { id: "rm010", name: "Ginger Root", category: "Flavoring", currentStock: 80, unit: "kg", minStock: 20, reorderLevel: 20, supplier: "Herb Suppliers Ltd", lastRestocked: new Date("2024-11-19"), preferredSupplier: "Herb Suppliers Ltd" },
  { id: "rm011", name: "Coffee Beans", category: "Flavoring", currentStock: 100, unit: "kg", minStock: 25, reorderLevel: 25, supplier: "Coffee Importers", lastRestocked: new Date("2024-11-21"), preferredSupplier: "Coffee Importers" },
  { id: "rm012", name: "Cocoa Powder", category: "Flavoring", currentStock: 55, unit: "kg", minStock: 12, reorderLevel: 12, supplier: "Spice Importers", lastRestocked: new Date("2024-11-13"), preferredSupplier: "Spice Importers" },
  { id: "rm013", name: "Distilled Water", category: "Base", currentStock: 2000, unit: "litres", minStock: 500, reorderLevel: 500, supplier: "Water Purification Co", lastRestocked: new Date("2024-11-25"), preferredSupplier: "Water Purification Co" },
  { id: "rm014", name: "Sugar Cane", category: "Base", currentStock: 300, unit: "kg", minStock: 75, reorderLevel: 75, supplier: "Natural Ingredients Co", lastRestocked: new Date("2024-11-17"), preferredSupplier: "Natural Ingredients Co" },
  { id: "rm015", name: "500ml Bottles", category: "Packaging", currentStock: 5000, unit: "pcs", minStock: 1000, reorderLevel: 1000, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-24"), preferredSupplier: "Packaging Solutions Inc" },
  { id: "rm016", name: "1L Bottles", category: "Packaging", currentStock: 3000, unit: "pcs", minStock: 800, reorderLevel: 800, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-23"), preferredSupplier: "Packaging Solutions Inc" },
  { id: "rm017", name: "2L Bottles", category: "Packaging", currentStock: 1500, unit: "pcs", minStock: 400, reorderLevel: 400, supplier: "Packaging Solutions Inc", lastRestocked: new Date("2024-11-22"), preferredSupplier: "Packaging Solutions Inc" },
  { id: "rm018", name: "Labels", category: "Packaging", currentStock: 10000, unit: "pcs", minStock: 2000, reorderLevel: 2000, supplier: "Print Solutions Ltd", lastRestocked: new Date("2024-11-20"), preferredSupplier: "Print Solutions Ltd" },
]

// Generate 30 batches with enhanced data
const generateBatches = (): Batch[] => {
  const batches: Batch[] = []
  const statuses: Batch["status"][] = ["Processing", "QC Pending", "Completed", "Ready for Distribution"]
  const qcStatuses: Batch["qcStatus"][] = ["Pending", "Pass", "Fail", "In Progress"]
  const shifts: Batch["shift"][] = ["Morning", "Afternoon", "Night"]
  const supervisors = ["Marcus Johnson", "Sarah Williams", "David Chen", "Emily Taylor"]
  
  for (let i = 1; i <= 30; i++) {
    const batchNum = `BCH-2025-${String(i).padStart(5, "0")}`
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 60))
    
    const flavor = flavors[Math.floor(Math.random() * flavors.length)]
    const productCategory = productCategories[Math.floor(Math.random() * productCategories.length)]
    const totalLitres = Math.floor(Math.random() * 200) + 50
    const bottles500ml = Math.floor(Math.random() * 300) + 50
    const bottles1L = Math.floor(Math.random() * 150) + 30
    const bottles2L = Math.floor(Math.random() * 80) + 10
    
    const used500ml = bottles500ml * 0.5
    const used1L = bottles1L * 1
    const used2L = bottles2L * 2
    const totalUsed = used500ml + used1L + used2L
    const remainingLitres = Math.max(0, totalLitres - totalUsed)
    
    const startTime = new Date(date)
    startTime.setHours(8 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0)
    const endTime = new Date(startTime)
    endTime.setHours(startTime.getHours() + Math.floor(Math.random() * 4) + 2)
    
    const ingredients = [
      { 
        material: rawMaterials[Math.floor(Math.random() * rawMaterials.length)].name, 
        quantity: Math.floor(Math.random() * 50) + 10, 
        unit: "kg",
        unitCost: Math.random() * 50 + 10,
        totalCost: 0,
        lotNumber: `LOT-${Math.floor(Math.random() * 9999)}`,
        supplier: "Premium Spirits Ltd"
      },
      { 
        material: rawMaterials[Math.floor(Math.random() * rawMaterials.length)].name, 
        quantity: Math.floor(Math.random() * 30) + 5, 
        unit: "litres",
        unitCost: Math.random() * 30 + 5,
        totalCost: 0,
        lotNumber: `LOT-${Math.floor(Math.random() * 9999)}`,
        supplier: "Natural Ingredients Co"
      },
    ]
    
    ingredients.forEach(ing => {
      ing.totalCost = ing.quantity * ing.unitCost
    })
    
    batches.push({
      id: `batch-${i}`,
      batchNumber: batchNum,
      date,
      flavor,
      productCategory,
      totalLitres,
      bottles500ml,
      bottles1L,
      bottles2L,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      qcStatus: qcStatuses[Math.floor(Math.random() * qcStatuses.length)],
      supervisor: supervisors[Math.floor(Math.random() * supervisors.length)],
      shift: shifts[Math.floor(Math.random() * shifts.length)],
      productionStartTime: startTime,
      productionEndTime: endTime,
      mixingDuration: Math.floor(Math.random() * 120) + 30,
      processingHours: Math.floor(Math.random() * 48) + 12,
      expectedLoss: Math.random() * 5 + 1,
      actualLoss: Math.random() * 6 + 0.5,
      temperature: Math.floor(Math.random() * 10) + 18,
      ingredients,
      documents: Math.random() > 0.5 ? [`${batchNum}-cert.pdf`, `${batchNum}-qc.pdf`] : [],
      packagingTeam: ["John Doe", "Jane Smith", "Mike Johnson"].slice(0, Math.floor(Math.random() * 3) + 1),
      packagingTime: endTime,
      outputSummary: {
        totalBottles: bottles500ml + bottles1L + bottles2L,
        remainingLitres: Math.round(remainingLitres * 10) / 10,
        breakdown: [
          { size: "500ml", quantity: bottles500ml, litres: Math.round(used500ml * 10) / 10 },
          { size: "1L", quantity: bottles1L, litres: Math.round(used1L * 10) / 10 },
          { size: "2L", quantity: bottles2L, litres: Math.round(used2L * 10) / 10 },
        ],
      },
    })
  }
  
  return batches.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const batches: Batch[] = generateBatches()

// Distributors
export const distributors: Distributor[] = [
  {
    id: "dist001",
    name: "Premium Liquor Distributors",
    type: "Internal Distributor",
    category: "Distributor",
    contactPerson: "Michael Johnson",
    phone: "+1 555-2001",
    email: "michael@premiumliquor.com",
    address: "123 Distribution Ave, New York, NY 10001",
    itemsSupplied: ["Honey Infused Whiskey", "Herb Infused Gin", "Vanilla Bourbon"],
    notes: "Primary distributor for premium products",
    region: "Northeast",
    volumeMonthly: 5000,
    deliveryFrequency: "Weekly",
  },
  {
    id: "dist002",
    name: "Regional Beverage Network",
    type: "Internal Distributor",
    category: "Distributor",
    contactPerson: "Sarah Williams",
    phone: "+1 555-2002",
    email: "sarah@regionalbev.com",
    address: "456 Network Blvd, Los Angeles, CA 90001",
    itemsSupplied: ["Spiced Rum Blend", "Citrus Vodka Fusion", "Peach Whiskey"],
    region: "West Coast",
    volumeMonthly: 3500,
    deliveryFrequency: "Bi-weekly",
  },
  {
    id: "dist003",
    name: "Artisan Spirits Co",
    type: "External Supplier",
    category: "Liquor",
    contactPerson: "David Chen",
    phone: "+1 555-2003",
    email: "david@artisanspirits.com",
    address: "789 Craft Street, San Francisco, CA 94101",
    itemsSupplied: ["Premium Whiskey Base", "Gin Base"],
    notes: "Supplies base spirits",
    deliveryFrequency: "Monthly",
  },
  {
    id: "dist004",
    name: "Natural Ingredients Co",
    type: "External Supplier",
    category: "Raw Material",
    contactPerson: "Lisa Anderson",
    phone: "+1 555-2004",
    email: "lisa@naturalingredients.com",
    address: "321 Organic Way, Portland, OR 97201",
    itemsSupplied: ["Organic Honey", "Citrus Extract", "Peach Extract", "Sugar Cane"],
    deliveryFrequency: "Bi-weekly",
  },
  {
    id: "dist005",
    name: "Herb Suppliers Ltd",
    type: "External Supplier",
    category: "Raw Material",
    contactPerson: "Robert Martinez",
    phone: "+1 555-2005",
    email: "robert@herbsuppliers.com",
    address: "654 Garden Lane, Austin, TX 78701",
    itemsSupplied: ["Fresh Herbs Mix", "Lavender Flowers", "Fresh Mint", "Ginger Root"],
    deliveryFrequency: "Weekly",
  },
  {
    id: "dist006",
    name: "Spice Importers",
    type: "External Supplier",
    category: "Raw Material",
    contactPerson: "Jennifer Lee",
    phone: "+1 555-2006",
    email: "jennifer@spiceimporters.com",
    address: "987 Spice Road, Miami, FL 33101",
    itemsSupplied: ["Vanilla Beans", "Cinnamon Sticks", "Cocoa Powder"],
    deliveryFrequency: "Monthly",
  },
  {
    id: "dist007",
    name: "Coffee Importers",
    type: "External Supplier",
    category: "Raw Material",
    contactPerson: "Thomas Brown",
    phone: "+1 555-2007",
    email: "thomas@coffeeimporters.com",
    address: "147 Bean Avenue, Seattle, WA 98101",
    itemsSupplied: ["Coffee Beans"],
    deliveryFrequency: "Monthly",
  },
  {
    id: "dist008",
    name: "Water Purification Co",
    type: "External Supplier",
    category: "Raw Material",
    contactPerson: "Patricia Davis",
    phone: "+1 555-2008",
    email: "patricia@waterpurification.com",
    address: "258 Pure Water Drive, Denver, CO 80201",
    itemsSupplied: ["Distilled Water"],
    deliveryFrequency: "Weekly",
  },
  {
    id: "dist009",
    name: "Retail Branch - Downtown",
    type: "Internal Distributor",
    category: "Distributor",
    contactPerson: "James Wilson",
    phone: "+1 555-2009",
    email: "james@retaildowntown.com",
    address: "369 Main Street, Chicago, IL 60601",
    itemsSupplied: ["All Products"],
    notes: "Main retail location",
    region: "Midwest",
    volumeMonthly: 2000,
    deliveryFrequency: "Daily",
  },
  {
    id: "dist010",
    name: "Retail Branch - Uptown",
    type: "Internal Distributor",
    category: "Distributor",
    contactPerson: "Emily Taylor",
    phone: "+1 555-2010",
    email: "emily@retailuptown.com",
    address: "741 Commerce Blvd, Boston, MA 02101",
    itemsSupplied: ["All Products"],
    region: "Northeast",
    volumeMonthly: 1800,
    deliveryFrequency: "Daily",
  },
]

// Delivery Notes
const generateDeliveryNotes = (): DeliveryNote[] => {
  const notes: DeliveryNote[] = []
  const statuses: DeliveryNote["status"][] = ["Pending", "In Transit", "Delivered"]
  
  for (let i = 1; i <= 15; i++) {
    const batch = batches[Math.floor(Math.random() * batches.length)]
    const distributor = distributors[Math.floor(Math.random() * distributors.length)]
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))
    
    const timeOut = new Date(date)
    timeOut.setHours(8 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0)
    const timeDelivered = new Date(timeOut)
    timeDelivered.setHours(timeOut.getHours() + Math.floor(Math.random() * 4) + 1)
    
    notes.push({
      id: `note-${i}`,
      noteId: `DN-${String(i).padStart(6, "0")}`,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      distributorId: distributor.id,
      distributorName: distributor.name,
      date,
      items: [
        { size: "500ml", quantity: Math.floor(Math.random() * 100) + 20 },
        { size: "1L", quantity: Math.floor(Math.random() * 50) + 10 },
        { size: "2L", quantity: Math.floor(Math.random() * 30) + 5 },
      ],
      vehicle: Math.random() > 0.3 ? `TRUCK-${Math.floor(Math.random() * 9999)}` : undefined,
      driver: Math.random() > 0.3 ? ["John Driver", "Jane Smith", "Mike Johnson"][Math.floor(Math.random() * 3)] : undefined,
      notes: Math.random() > 0.5 ? "Standard delivery" : undefined,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      deliveryLocation: distributor.address,
      timeOut: timeOut,
      timeDelivered: statuses[Math.floor(Math.random() * statuses.length)] === "Delivered" ? timeDelivered : undefined,
      verificationStatus: statuses[Math.floor(Math.random() * statuses.length)] === "Delivered" ? (Math.random() > 0.3 ? "Verified" : "Pending") : undefined,
    })
  }
  
  return notes.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const deliveryNotes: DeliveryNote[] = generateDeliveryNotes()

// Material Usage Logs
const generateMaterialUsageLogs = (): MaterialUsageLog[] => {
  const logs: MaterialUsageLog[] = []
  const approvers = ["Marcus Johnson", "Sarah Williams", "David Chen"]
  
  batches.forEach((batch) => {
    batch.ingredients.forEach((ing) => {
      const material = rawMaterials.find((rm) => rm.name === ing.material)
      if (material) {
        logs.push({
          id: `log-${logs.length + 1}`,
          materialId: material.id,
          materialName: ing.material,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantityUsed: ing.quantity,
          unit: ing.unit,
          remainingStock: material.currentStock - ing.quantity,
          date: batch.date,
          approvedBy: approvers[Math.floor(Math.random() * approvers.length)],
        })
      }
    })
  })
  
  return logs.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const materialUsageLogs: MaterialUsageLog[] = generateMaterialUsageLogs()

// QC Results
const generateQCResults = (): QCResult[] => {
  const results: QCResult[] = []
  const inspectors = ["QC Inspector 1", "QC Inspector 2", "QC Inspector 3"]
  const checklistItems = [
    "Color check",
    "Viscosity",
    "Aroma test",
    "pH levels",
    "Alcohol content",
    "Microbial safety",
    "Packaging seal test",
    "Label correctness",
  ]
  
  batches.forEach((batch) => {
    if (batch.qcStatus !== "Pending") {
      const checklist = checklistItems.map((item) => ({
        item,
        result: Math.random() > 0.15 ? "Pass" : "Fail" as "Pass" | "Fail",
        notes: Math.random() > 0.7 ? "Within acceptable range" : undefined,
      }))
      
      results.push({
        id: `qc-${batch.id}`,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        inspector: inspectors[Math.floor(Math.random() * inspectors.length)],
        status: batch.qcStatus === "Pass" ? "Pass" : batch.qcStatus === "Fail" ? "Fail" : "Pending",
        date: new Date(batch.date.getTime() + 86400000), // Day after production
        checklist,
        notes: batch.qcStatus === "Fail" ? "Minor issues detected, requires review" : undefined,
      })
    }
  })
  
  return results
}

export const qcResults: QCResult[] = generateQCResults()

// Packaging Outputs
const generatePackagingOutputs = (): PackagingOutput[] => {
  const outputs: PackagingOutput[] = []
  const packagingLines = ["Line A", "Line B", "Line C"]
  const workers = ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Lee", "Tom Brown"]
  
  batches.forEach((batch) => {
    const sizes = [
      { size: "500ml" as const, qty: batch.bottles500ml },
      { size: "1L" as const, qty: batch.bottles1L },
      { size: "2L" as const, qty: batch.bottles2L },
    ]
    
    sizes.forEach((s) => {
      if (s.qty > 0) {
        const startTime = batch.packagingTime || batch.date
        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + Math.floor(Math.random() * 120) + 30)
        const timeTaken = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)
        const defects = Math.floor(Math.random() * 5)
        const efficiency = Math.max(85, 100 - (defects / s.qty) * 100)
        
        outputs.push({
          id: `pkg-${batch.id}-${s.size}`,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          size: s.size,
          quantity: s.qty,
          packagingLine: packagingLines[Math.floor(Math.random() * packagingLines.length)],
          workers: workers.slice(0, Math.floor(Math.random() * 3) + 2),
          startTime,
          endTime,
          timeTaken,
          defects,
          efficiency: Math.round(efficiency * 10) / 10,
        })
      }
    })
  })
  
  return outputs
}

export const packagingOutputs: PackagingOutput[] = generatePackagingOutputs()

// Finished Goods
const generateFinishedGoods = (): FinishedGood[] => {
  const goods: FinishedGood[] = []
  const storageLocations = ["A-1-01", "A-1-02", "A-2-01", "B-1-01", "B-1-02", "C-1-01"]
  
  batches.forEach((batch) => {
    if (batch.status === "Completed" || batch.status === "Ready for Distribution") {
      const sizes = [
        { size: "500ml" as const, qty: batch.bottles500ml },
        { size: "1L" as const, qty: batch.bottles1L },
        { size: "2L" as const, qty: batch.bottles2L },
      ]
      
      sizes.forEach((s) => {
        if (s.qty > 0) {
          const existing = goods.find((g) => g.flavor === batch.flavor && g.size === s.size)
          if (existing) {
            existing.quantity += s.qty
            existing.batches.push(batch.batchNumber)
          } else {
            goods.push({
              id: `fg-${goods.length + 1}`,
              productType: batch.productCategory,
              flavor: batch.flavor,
              size: s.size,
              quantity: s.qty,
              batches: [batch.batchNumber],
              storageLocation: storageLocations[Math.floor(Math.random() * storageLocations.length)],
              lastUpdated: batch.date,
            })
          }
        }
      })
    }
  })
  
  return goods
}

export const finishedGoods: FinishedGood[] = generateFinishedGoods()

// Stock Movements
const generateStockMovements = (): StockMovement[] => {
  const movements: StockMovement[] = []
  const users = ["Marcus Johnson", "Sarah Williams", "David Chen", "Emily Taylor"]
  
  // Production IN movements
  batches.forEach((batch) => {
    if (batch.status === "Completed" || batch.status === "Ready for Distribution") {
      movements.push({
        id: `mov-${movements.length + 1}`,
        type: "IN",
        productType: batch.flavor,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: batch.outputSummary.totalBottles,
        unit: "bottles",
        reason: "Production completed",
        date: batch.date,
        user: batch.supervisor,
      })
    }
  })
  
  // Distribution OUT movements
  deliveryNotes.forEach((note) => {
    if (note.status === "Delivered") {
      const totalQty = note.items.reduce((sum, item) => sum + item.quantity, 0)
      movements.push({
        id: `mov-${movements.length + 1}`,
        type: "OUT",
        batchId: note.batchId,
        batchNumber: note.batchNumber,
        quantity: totalQty,
        unit: "bottles",
        reason: "Distribution",
        date: note.date,
        user: note.driver || "System",
        notes: `Delivered to ${note.distributorName}`,
      })
    }
  })
  
  // Material usage movements
  materialUsageLogs.forEach((log) => {
    movements.push({
      id: `mov-${movements.length + 1}`,
      type: "OUT",
      materialId: log.materialId,
      materialName: log.materialName,
      batchId: log.batchId,
      batchNumber: log.batchNumber,
      quantity: log.quantityUsed,
      unit: log.unit,
      reason: "Production usage",
      date: log.date,
      user: log.approvedBy,
    })
  })
  
  return movements.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const stockMovements: StockMovement[] = generateStockMovements()

// Dashboard Stats
export const dashboardStats = {
  totalBatches: batches.length,
  batchesThisMonth: batches.filter((b) => {
    const now = new Date()
    return b.date.getMonth() === now.getMonth() && b.date.getFullYear() === now.getFullYear()
  }).length || 12,
  batchesToday: batches.filter((b) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const batchDate = new Date(b.date)
    batchDate.setHours(0, 0, 0, 0)
    return batchDate.getTime() === today.getTime()
  }).length || 3,
  totalLitresManufactured: batches.reduce((sum, b) => sum + b.totalLitres, 0),
  litresProducedToday: batches
    .filter((b) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const batchDate = new Date(b.date)
      batchDate.setHours(0, 0, 0, 0)
      return batchDate.getTime() === today.getTime()
    })
    .reduce((sum, b) => sum + b.totalLitres, 0) || 245,
  batchesInQC: batches.filter((b) => b.qcStatus === "In Progress" || b.qcStatus === "Pending").length,
  finishedGoodsStock: {
    "500ml": finishedGoods.filter((fg) => fg.size === "500ml").reduce((sum, fg) => sum + fg.quantity, 0),
    "1L": finishedGoods.filter((fg) => fg.size === "1L").reduce((sum, fg) => sum + fg.quantity, 0),
    "2L": finishedGoods.filter((fg) => fg.size === "2L").reduce((sum, fg) => sum + fg.quantity, 0),
  },
  lowStockMaterials: rawMaterials.filter((rm) => rm.currentStock <= rm.minStock).length,
  currentRawMaterials: rawMaterials.length,
  totalRawMaterialStock: rawMaterials.reduce((sum, rm) => sum + rm.currentStock, 0),
  pendingDistributions: deliveryNotes.filter((dn) => dn.status === "Pending").length,
  completedDistributions: deliveryNotes.filter((dn) => dn.status === "Delivered").length,
}

// Daily Production Chart Data
export const dailyProductionData = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - i))
  date.setHours(0, 0, 0, 0)
  const dayBatches = batches.filter((b) => {
    const batchDate = new Date(b.date)
    batchDate.setHours(0, 0, 0, 0)
    return batchDate.getTime() === date.getTime()
  })
  return {
    date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    litres: dayBatches.reduce((sum, b) => sum + b.totalLitres, 0) || Math.floor(Math.random() * 200) + 50,
    batches: dayBatches.length || Math.floor(Math.random() * 5) + 1,
  }
})

// Weekly Production Summary
export const weeklyProductionData = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - i))
  const dayBatches = batches.filter((b) => {
    const batchDate = new Date(b.date)
    batchDate.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return batchDate.getTime() === checkDate.getTime()
  })
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    litres: dayBatches.reduce((sum, b) => sum + b.totalLitres, 0) || Math.floor(Math.random() * 300) + 100,
    batches: dayBatches.length || Math.floor(Math.random() * 8) + 2,
  }
})

// Material Usage Trends
export const materialUsageTrends = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - i))
  const dayLogs = materialUsageLogs.filter((log) => {
    const logDate = new Date(log.date)
    logDate.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return logDate.getTime() === checkDate.getTime()
  })
  return {
    date: date.toLocaleDateString("en-US", { weekday: "short" }),
    usage: dayLogs.reduce((sum, log) => sum + log.quantityUsed, 0) || Math.floor(Math.random() * 200) + 50,
  }
})

// QC Pass/Fail Data
export const qcPassFailData = [
  { name: "Pass", value: qcResults.filter((qc) => qc.status === "Pass").length, color: "#10b981" },
  { name: "Fail", value: qcResults.filter((qc) => qc.status === "Fail").length, color: "#ef4444" },
  { name: "Pending", value: qcResults.filter((qc) => qc.status === "Pending").length, color: "#f59e0b" },
]

// Distribution Deliveries for Week
export const weeklyDistributionData = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - i))
  const dayDeliveries = deliveryNotes.filter((dn) => {
    const deliveryDate = new Date(dn.date)
    deliveryDate.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return deliveryDate.getTime() === checkDate.getTime()
  })
  return {
    date: date.toLocaleDateString("en-US", { weekday: "short" }),
    deliveries: dayDeliveries.length || Math.floor(Math.random() * 5),
    quantity: dayDeliveries.reduce((sum, dn) => {
      return sum + dn.items.reduce((s, item) => s + item.quantity, 0)
    }, 0) || Math.floor(Math.random() * 500) + 100,
  }
})

// Production Outputs (raw production before packaging)
const generateProductionOutputs = (): ProductionOutput[] => {
  const outputs: ProductionOutput[] = []
  const supervisors = ["Marcus Johnson", "Sarah Williams", "David Chen", "Emily Taylor"]
  const tankNumbers = ["TANK-001", "TANK-002", "TANK-003", "DRUM-101", "DRUM-102"]
  
  batches.forEach((batch) => {
    outputs.push({
      id: `prod-out-${batch.id}`,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      date: batch.date,
      flavor: batch.flavor,
      productCategory: batch.productCategory,
      totalLitres: batch.totalLitres,
      shift: batch.shift,
      supervisor: batch.supervisor,
      tankNumber: tankNumbers[Math.floor(Math.random() * tankNumbers.length)],
      processingDuration: batch.processingHours,
      actualLoss: batch.actualLoss,
      lossType: "percentage",
      certifiedBy: batch.supervisor,
      status: Math.random() > 0.6 ? "Stored" : Math.random() > 0.5 ? "Sent for Packaging" : "Awaiting QC",
      qcStatus: batch.qcStatus,
    })
  })
  
  return outputs.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const productionOutputs: ProductionOutput[] = generateProductionOutputs()

// Packaging Sessions (packaging after production)
const generatePackagingSessions = (): PackagingSession[] => {
  const sessions: PackagingSession[] = []
  const packagingLines = ["LINE-01", "LINE-02", "LINE-03"]
  const supervisors = ["John Doe", "Jane Smith", "Mike Johnson"]
  const teamMembers = ["Worker A", "Worker B", "Worker C", "Worker D", "Worker E"]
  
  productionOutputs
    .filter((po) => po.status === "Stored")
    .slice(0, 25)
    .forEach((output, idx) => {
      const sessionDate = new Date(output.date)
      sessionDate.setDate(sessionDate.getDate() + Math.floor(Math.random() * 3) + 1) // 1-3 days after production
      
      const output500ml = Math.floor(Math.random() * 200) + 50
      const output1L = Math.floor(Math.random() * 100) + 30
      const output2L = Math.floor(Math.random() * 50) + 10
      const totalLitresUsed = (output500ml * 0.5) + (output1L * 1) + (output2L * 2)
      const defects = Math.floor(Math.random() * 10)
      const efficiency = Math.max(85, 100 - (defects / (output500ml + output1L + output2L)) * 100)
      
      sessions.push({
        id: `pkg-session-${idx + 1}`,
        sessionId: `PKG-${String(idx + 1).padStart(5, "0")}`,
        batchId: output.batchId,
        batchNumber: output.batchNumber,
        date: sessionDate,
        totalLitresUsed: Math.round(totalLitresUsed * 10) / 10,
        output500ml,
        output1L,
        output2L,
        otherSizes: Math.random() > 0.7 ? [{ size: "750ml", quantity: Math.floor(Math.random() * 30) + 10 }] : undefined,
        packagingLine: packagingLines[Math.floor(Math.random() * packagingLines.length)],
        supervisor: supervisors[Math.floor(Math.random() * supervisors.length)],
        teamMembers: teamMembers.slice(0, Math.floor(Math.random() * 3) + 2),
        defects,
        defectReasons: defects > 0 ? "Label misalignment, seal defects" : undefined,
        machineEfficiency: Math.floor(Math.random() * 10) + 90,
        efficiency: Math.round(efficiency * 10) / 10,
        status: Math.random() > 0.7 ? "Completed" : Math.random() > 0.5 ? "In Progress" : "Pending",
        packagingSessionSource: output.batchNumber,
      })
    })
  
  return sessions.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const packagingSessions: PackagingSession[] = generatePackagingSessions()
