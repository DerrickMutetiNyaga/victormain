import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-jaba'
import { getJabaSmsSettings, normalizePhoneNumbers, saveJabaSmsSettings, sendJabaSms } from '@/lib/jaba-sms'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await getJabaSmsSettings()
    return NextResponse.json({
      ...settings,
      updatedAt: settings.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('[Jaba SMS Settings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch SMS settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const saved = await saveJabaSmsSettings({
      enabled: Boolean(body.enabled),
      numbers: normalizePhoneNumbers(body.numbers),
      events: {
        batchCreated: Boolean(body.events?.batchCreated),
        packagingCreated: Boolean(body.events?.packagingCreated),
        distributionCreated: Boolean(body.events?.distributionCreated),
        distributionDelivered: Boolean(body.events?.distributionDelivered),
      },
      updatedBy: session.user.email || undefined,
    })

    return NextResponse.json({
      ...saved,
      updatedAt: saved.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('[Jaba SMS Settings] PUT failed:', error)
    return NextResponse.json({ error: 'Failed to save SMS settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const inputNumbers = normalizePhoneNumbers(body.numbers)
    const settings = await getJabaSmsSettings()
    const targetNumbers = inputNumbers.length > 0 ? inputNumbers : settings.numbers

    if (targetNumbers.length === 0) {
      console.error('[Jaba SMS Test] No valid numbers in request or saved settings')
      return NextResponse.json({ error: 'No valid SMS numbers found for test' }, { status: 400 })
    }

    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : `Jaba SMS test: Zettatel integration is working (${new Date().toLocaleString()}).`

    console.log('[Jaba SMS Test] Sending test SMS', {
      initiatedBy: session.user.email,
      recipientCount: targetNumbers.length,
      recipients: targetNumbers,
      messageLength: message.length,
    })

    await sendJabaSms(message, targetNumbers)
    console.log('[Jaba SMS Test] Test SMS sent successfully')
    return NextResponse.json({ success: true, sentTo: targetNumbers.length })
  } catch (error) {
    console.error('[Jaba SMS Settings] POST test failed:', error)
    return NextResponse.json({ error: 'Failed to send test SMS' }, { status: 500 })
  }
}
