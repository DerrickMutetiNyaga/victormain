/**
 * Returned in API JSON when purge cannot run because the deployment does not support
 * multi-document transactions (e.g. standalone MongoDB). Safe to import from client components.
 */
export const JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE = 'MONGODB_TRANSACTIONS_REQUIRED' as const

export type JabaPurgeErrorCode = typeof JABA_PURGE_MONGODB_TRANSACTIONS_REQUIRED_CODE
