import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const runtime = 'nodejs'

// GET material usage reports data
export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db('infusion_jaba')
    const { ObjectId } = await import('mongodb')

    console.log('[Material Reports API] Fetching material reports data...')

    // Get all raw materials
    const rawMaterials = await db.collection('jaba_rawMaterials')
      .find({})
      .toArray()

    console.log(`[Material Reports API] Found ${rawMaterials.length} raw materials`)

    // Get all batches to calculate material usage
    const batches = await db.collection('jaba_batches')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    console.log(`[Material Reports API] Found ${batches.length} batches`)

    // Calculate material usage from batches (ingredients used)
    const materialUsage: Map<string, {
      materialId: string
      materialName: string
      category: string
      totalUsed: number
      unit: string
      batches: number
      cost: number
    }> = new Map()

    batches.forEach((batch: any) => {
      if (batch.ingredients && Array.isArray(batch.ingredients)) {
        batch.ingredients.forEach((ingredient: any) => {
          const materialName = ingredient.material || ingredient.name || ''
          const quantity = parseFloat(ingredient.quantity) || 0
          const unit = ingredient.unit || 'kg'
          const unitCost = parseFloat(ingredient.unitCost) || 0
          const totalCost = parseFloat(ingredient.totalCost) || (quantity * unitCost)

          if (materialName && quantity > 0) {
            const existing = materialUsage.get(materialName)
            if (existing) {
              existing.totalUsed += quantity
              existing.cost += totalCost
              existing.batches += 1
            } else {
              // Find material in rawMaterials to get category
              const material = rawMaterials.find((rm: any) => 
                rm.name.toLowerCase() === materialName.toLowerCase()
              )
              
              materialUsage.set(materialName, {
                materialId: material?._id?.toString() || '',
                materialName: materialName,
                category: material?.category || 'Other',
                totalUsed: quantity,
                unit: unit,
                batches: 1,
                cost: totalCost,
              })
            }
          }
        })
      }
    })

    // Convert map to array
    const usageArray = Array.from(materialUsage.values())

    // Calculate monthly usage (last 6 months)
    const monthlyUsage: { month: string; usage: number; cost: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      
      // Calculate usage for this month
      let monthUsage = 0
      let monthCost = 0
      
      batches.forEach((batch: any) => {
        const batchDate = batch.date instanceof Date ? batch.date : new Date(batch.date)
        if (
          batchDate.getMonth() === monthDate.getMonth() &&
          batchDate.getFullYear() === monthDate.getFullYear()
        ) {
          if (batch.ingredients && Array.isArray(batch.ingredients)) {
            batch.ingredients.forEach((ingredient: any) => {
              const quantity = parseFloat(ingredient.quantity) || 0
              const totalCost = parseFloat(ingredient.totalCost) || 0
              monthUsage += quantity
              monthCost += totalCost
            })
          }
        }
      })
      
      monthlyUsage.push({
        month: monthName,
        usage: Math.round(monthUsage),
        cost: Math.round(monthCost),
      })
    }

    // Calculate category usage
    const categoryUsageMap = new Map<string, { quantity: number; materials: number }>()
    
    usageArray.forEach((usage) => {
      const existing = categoryUsageMap.get(usage.category)
      if (existing) {
        existing.quantity += usage.totalUsed
        existing.materials += 1
      } else {
        categoryUsageMap.set(usage.category, {
          quantity: usage.totalUsed,
          materials: 1,
        })
      }
    })

    const categoryUsage = Array.from(categoryUsageMap.entries()).map(([category, data]) => ({
      category,
      quantity: data.quantity,
      materials: data.materials,
    }))

    // Calculate stock levels
    const stockLevels = {
      critical: rawMaterials.filter((rm: any) => rm.currentStock <= (rm.minStock || 0) * 0.5).length,
      low: rawMaterials.filter((rm: any) => 
        rm.currentStock > (rm.minStock || 0) * 0.5 && rm.currentStock <= (rm.minStock || 0)
      ).length,
      normal: rawMaterials.filter((rm: any) => 
        rm.currentStock > (rm.minStock || 0) && rm.currentStock <= (rm.minStock || 0) * 2
      ).length,
      high: rawMaterials.filter((rm: any) => rm.currentStock > (rm.minStock || 0) * 2).length,
    }

    // Calculate statistics
    const totalMaterials = rawMaterials.length
    const lowStockMaterials = rawMaterials.filter((rm: any) => 
      rm.currentStock <= (rm.minStock || 0)
    ).length
    
    // Calculate total stock value (using average cost from usage - no defaults, only real data)
    const totalStockValue = rawMaterials.reduce((sum: number, rm: any) => {
      const usage = usageArray.find(u => u.materialName.toLowerCase() === rm.name.toLowerCase())
      // Only calculate if we have real usage data, otherwise skip (don't use default cost)
      if (usage && usage.totalUsed > 0) {
        const avgCost = usage.cost / usage.totalUsed
        return sum + (rm.currentStock * avgCost)
      }
      return sum // Skip materials without usage data - don't add fake values
    }, 0)

    // Get current month usage
    const currentMonth = monthlyUsage[monthlyUsage.length - 1]
    const monthlyUsageValue = currentMonth?.usage || 0
    const monthlyCost = currentMonth?.cost || 0

    // Top materials by usage
    const topMaterials = usageArray
      .map((usage) => {
        const material = rawMaterials.find((rm: any) => 
          rm.name.toLowerCase() === usage.materialName.toLowerCase()
        )
        return {
          name: usage.materialName,
          category: usage.category,
          quantityUsed: usage.totalUsed,
          unit: usage.unit,
          cost: usage.cost,
          currentStock: material?.currentStock || 0,
          minStock: material?.minStock || 0,
        }
      })
      .sort((a, b) => b.quantityUsed - a.quantityUsed)
      .slice(0, 10)

    // Recent usage logs (from batches)
    const recentLogs = batches
      .slice(0, 20)
      .flatMap((batch: any) => {
        if (!batch.ingredients || !Array.isArray(batch.ingredients)) return []
        
        return batch.ingredients.map((ingredient: any) => {
          const material = rawMaterials.find((rm: any) => 
            rm.name.toLowerCase() === (ingredient.material || ingredient.name || '').toLowerCase()
          )
          
          return {
            id: `${batch._id.toString()}-${ingredient.material || ingredient.name}`,
            materialName: ingredient.material || ingredient.name || 'Unknown',
            batchNumber: batch.batchNumber || 'N/A',
            quantityUsed: parseFloat(ingredient.quantity) || 0,
            unit: ingredient.unit || 'kg',
            remainingStock: material?.currentStock || 0,
            date: batch.date instanceof Date ? batch.date.toISOString() : batch.date,
            approvedBy: batch.supervisor || 'System',
          }
        })
      })
      .filter(log => log.materialName !== 'Unknown')
      .slice(0, 20)

    console.log(`[Material Reports API] ✅ Returning material reports data`)

    return NextResponse.json({
      totalMaterials,
      lowStockMaterials,
      totalStockValue,
      monthlyUsageValue,
      monthlyCost,
      monthlyUsage,
      categoryUsage,
      stockLevels: [
        { level: 'Critical', count: stockLevels.critical },
        { level: 'Low', count: stockLevels.low },
        { level: 'Normal', count: stockLevels.normal },
        { level: 'High', count: stockLevels.high },
      ],
      topMaterials,
      recentLogs,
      categories: Array.from(new Set(rawMaterials.map((rm: any) => rm.category))),
    })
  } catch (error: any) {
    console.error('[Material Reports API] ❌ Error fetching material reports:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch material reports',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}
