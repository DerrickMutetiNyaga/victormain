/**
 * Structured auth events for logs / external SIEM (console JSON in dev).
 * Never log passwords, OTPs, or full session tokens.
 */

export type AuthAuditEvent = {
  type: 'auth_audit'
  route: string
  action: string
  result: 'success' | 'rejected' | 'rate_limited'
  reason?: string
  userId?: string
  identifier?: string
  ip?: string | null
  userAgent?: string | null
  ts: string
}

export function logAuthSecurityEvent(
  partial: Omit<AuthAuditEvent, 'type' | 'ts'> & { ts?: string }
): void {
  const evt: AuthAuditEvent = {
    type: 'auth_audit',
    ts: partial.ts ?? new Date().toISOString(),
    route: partial.route,
    action: partial.action,
    result: partial.result,
    reason: partial.reason,
    userId: partial.userId,
    identifier: partial.identifier,
    ip: partial.ip,
    userAgent: partial.userAgent,
  }
  console.log(JSON.stringify(evt))
}
