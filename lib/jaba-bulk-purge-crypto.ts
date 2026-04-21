import { createHash } from 'crypto'

/** SHA-256 hex of purge token (never store raw token in MongoDB). */
export function hashJabaBulkPurgeToken(purgeToken: string): string {
  return createHash('sha256').update(purgeToken, 'utf8').digest('hex')
}
