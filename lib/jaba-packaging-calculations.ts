/**
 * Shared packaging maths for Jaba — used by API routes and can be reused by UI helpers.
 */

export function normalizeQty(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
  return Number.isFinite(n) ? n : 0
}

export function getTotalContainerUnits(containers: Array<{ quantity?: string | number }>): number {
  return containers.reduce((sum, c) => sum + normalizeQty(c.quantity), 0)
}

export function rowLitresFromContainer(container: {
  quantity?: unknown
  size?: string
  customSize?: unknown
}): number {
  return computePackagedLitresFromContainers([container])
}

/** Litres packed from container rows (matches packaging-output API). */
export function computePackagedLitresFromContainers(
  containers: Array<{ quantity?: unknown; size?: string; customSize?: unknown }>
): number {
  return (containers || []).reduce((sum: number, container: any) => {
    const qty = normalizeQty(container.quantity)
    if (container.size === '250ml') {
      return sum + qty * 0.25
    }
    if (container.size === '500ml') {
      return sum + qty * 0.5
    }
    if (container.size === '1L') {
      return sum + qty * 1
    }
    if (container.size === '2L') {
      return sum + qty * 2
    }
    if (container.customSize) {
      const customSize = parseFloat(String(container.customSize)) || 0
      return sum + qty * (customSize / 1000)
    }
    return sum
  }, 0)
}
