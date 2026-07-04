import type { Db } from "mongodb"

export type IngredientInput = {
  material?: string
  quantity?: number
  unit?: string
  materialId?: string
  unitCost?: number
  totalCost?: number
  lotNumber?: string
  supplier?: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? n : 0
}

/**
 * Fill unitCost / totalCost / lot / supplier from the latest supplier restock
 * that recorded a line cost (jaba_supplierHistory). Batch UI used to send zeros only.
 */
export async function enrichIngredientsCosts(db: Db, ingredients: unknown[]): Promise<IngredientInput[]> {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return []

  const { ObjectId } = await import("mongodb")
  const list = ingredients as IngredientInput[]

  return Promise.all(
    list.map(async (ing) => {
      const materialName = String(ing.material || "").trim()
      const qty = num(ing.quantity)
      const existingUc = num(ing.unitCost)
      const existingTc = num(ing.totalCost)

      if (materialName && qty > 0 && existingUc > 0) {
        const totalCost = existingTc > 0 ? existingTc : Math.round(existingUc * qty * 10000) / 10000
        return {
          ...ing,
          material: materialName,
          quantity: qty,
          unitCost: existingUc,
          totalCost,
          lotNumber: ing.lotNumber || "",
          supplier: ing.supplier || "",
        }
      }

      const restock = materialName
        ? await db.collection("jaba_supplierHistory").findOne(
            {
              itemName: { $regex: new RegExp(`^${escapeRegex(materialName)}$`, "i") },
              type: { $regex: /^restock$/i },
              quantity: { $gt: 0 },
              cost: { $gt: 0 },
            },
            { sort: { date: -1, _id: -1 } }
          )
        : null

      if (restock && num(restock.cost) > 0 && num(restock.quantity) > 0) {
        const q0 = num(restock.quantity)
        const unitCost = num(restock.cost) / q0
        const totalCost = Math.round(unitCost * qty * 10000) / 10000
        return {
          ...ing,
          material: materialName,
          quantity: qty,
          unit: ing.unit || String(restock.unit || ""),
          unitCost: Math.round(unitCost * 10000) / 10000,
          totalCost,
          lotNumber: String(restock.lotNumber || ing.lotNumber || "").trim() || undefined,
          supplier: String(restock.supplierName || ing.supplier || "").trim() || undefined,
        }
      }

      let supplierFallback = ing.supplier ? String(ing.supplier) : ""
      if (!supplierFallback && ing.materialId) {
        try {
          const m = await db.collection("jaba_rawMaterials").findOne({ _id: new ObjectId(String(ing.materialId)) })
          if (m?.supplier) supplierFallback = String(m.supplier)
        } catch {
          /* ignore */
        }
      }
      if (!supplierFallback && materialName) {
        const m = await db.collection("jaba_rawMaterials").findOne({
          name: { $regex: new RegExp(`^${escapeRegex(materialName)}$`, "i") },
        })
        if (m?.supplier) supplierFallback = String(m.supplier)
      }

      return {
        ...ing,
        material: materialName,
        quantity: qty,
        unitCost: existingUc,
        totalCost: existingTc > 0 ? existingTc : existingUc > 0 ? Math.round(existingUc * qty * 10000) / 10000 : 0,
        lotNumber: ing.lotNumber || "",
        supplier: supplierFallback,
      }
    })
  )
}
