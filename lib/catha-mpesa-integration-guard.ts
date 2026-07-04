import { NextResponse } from 'next/server'
import { verifyMpesaEditSession } from '@/lib/catha-mpesa-integration-security'

export type RequireMpesaEditSessionResult =
  | { ok: true }
  | { response: NextResponse }

export async function requireMpesaEditSession(
  request: Request,
  requestedBy: string
): Promise<RequireMpesaEditSessionResult> {
  const token = request.headers.get('x-mpesa-edit-token') || ''
  if (!token) {
    return {
      response: NextResponse.json(
        { success: false, error: 'M-Pesa edit OTP required. Unlock settings with OTP first.' },
        { status: 403 }
      ),
    }
  }

  const valid = await verifyMpesaEditSession(token, requestedBy)
  if (!valid) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: 'M-Pesa edit session expired or invalid. Request a new OTP to continue.',
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true }
}
