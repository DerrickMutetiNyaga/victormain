/**
 * Canonical flavour names for Jaba neutral → flavoured allocation (UI defaults).
 * Kept in sync with product/barcode labels; resolve IDs via `jaba_flavors` when present.
 */
export const JABA_DEFAULT_INFUSION_FLAVOUR_NAMES = [
  "Berry",
  "Dawa",
  "Hibiscus",
  "Neutral",
  "Pineapple",
] as const

export type JabaDefaultInfusionFlavourName = (typeof JABA_DEFAULT_INFUSION_FLAVOUR_NAMES)[number]
