import type { Db } from 'mongodb'

const COLLECTION = 'jaba_security_audit_log'

export type JabaAuditEventType =
  | 'bulk_batch_purge_prepare'
  | 'bulk_batch_purge_execute_start'
  | 'bulk_batch_purge_execute_success'
  | 'bulk_batch_purge_execute_failure'
  | 'bulk_batch_purge_execute_partial'
  | 'bulk_batch_purge_root_ok'
  | 'bulk_batch_purge_root_failed'
  | 'bulk_batch_purge_root_skipped'

export async function insertJabaSecurityAudit(db: Db, entry: {
  type: JabaAuditEventType
  actorEmail: string
  ip: string | null
  userAgent: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.collection(COLLECTION).insertOne({
      ...entry,
      createdAt: new Date(),
    })
  } catch (e) {
    console.error('[jaba-security-audit] insert failed:', e)
  }
}
