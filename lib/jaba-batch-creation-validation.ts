/**
 * Client/server validation for "completed at creation" Jaba batches with flavour lines.
 */

export type FlavourLineValidationInput = {
  flavorName: string
  quantityLitres: number
}

export function validateCompletedBatchFlavourLines(
  availableLitres: number,
  lines: FlavourLineValidationInput[]
): { ok: true } | { ok: false; error: string } {
  const eps = 1e-6
  if (!Number.isFinite(availableLitres) || availableLitres <= 0) {
    return { ok: false, error: "Expected production volume must be a positive number." }
  }
  let sum = 0
  let positiveLines = 0
  for (const line of lines) {
    const q = Math.max(0, Number(line.quantityLitres) || 0)
    if (q > 0) {
      positiveLines++
      const name = (line.flavorName || "").trim()
      if (!name) {
        return { ok: false, error: "Each flavour line with litres needs a flavour selected." }
      }
      sum += q
    }
  }
  if (positiveLines < 1) {
    return { ok: false, error: "Add at least one flavour line with litres greater than zero." }
  }
  if (sum <= 0) {
    return { ok: false, error: "Total planned litres must be greater than zero." }
  }
  if (sum - availableLitres > eps) {
    return {
      ok: false,
      error: `Total planned litres (${sum.toFixed(2)}L) cannot exceed expected production volume (${availableLitres.toFixed(2)}L).`,
    }
  }
  return { ok: true }
}
