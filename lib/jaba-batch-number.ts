/**
 * Jaba batch numbers must be globally unique (enforced by DB index + API).
 */

export const JABA_DUPLICATE_BATCH_NUMBER_MESSAGE =
  'Batch number already exists. Please refresh and try again.'

export function normalizeJabaBatchNumber(input: unknown): string {
  if (input == null) return ''
  return String(input).trim()
}

/** MongoDB duplicate key error (E11000). */
export function isMongoDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  )
}
