const DEFAULT_REDIRECT = "/shop"

export function sanitizeShopRedirect(input: string | null | undefined): string {
  if (!input) return DEFAULT_REDIRECT
  if (!input.startsWith("/")) return DEFAULT_REDIRECT
  if (input.startsWith("//")) return DEFAULT_REDIRECT
  if (input.startsWith("/api/")) return DEFAULT_REDIRECT
  return input
}

export function getDefaultShopRedirect(): string {
  return DEFAULT_REDIRECT
}
