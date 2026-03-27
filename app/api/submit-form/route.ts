import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const SMTP_EMAIL = process.env.SMTP_EMAIL
const SMTP_PASSWORD = process.env.SMTP_PASSWORD
const SMTP_HOST = process.env.SMTP_HOST || 'mail.infusionjaba.co.ke'
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465
const FORM_SUBMISSION_TO = process.env.FORM_SUBMISSION_TO || 'jaba.infusion@gmail.com'
const REPLY_TO = process.env.REPLY_TO

function getTransporter() {
  const is465 = SMTP_PORT === 465
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: is465,
    requireTLS: !is465 && SMTP_PORT === 587,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    logger: true,
    debug: true,
    auth: SMTP_EMAIL && SMTP_PASSWORD
      ? { user: SMTP_EMAIL, pass: SMTP_PASSWORD }
      : undefined,
  })
}

function buildDistributorEmailBody(body: Record<string, unknown>): string {
  return [
    'New Jaba Distributor Application',
    '==============================',
    `Name: ${body.name ?? '-'}`,
    `Phone: ${body.phone ?? '-'}`,
    `Email: ${body.email ?? '-'}`,
    `Company: ${body.company ?? '-'}`,
    `Location: ${body.location ?? '-'}`,
    `Preferred Distribution Area: ${body.distributionArea ?? '-'}`,
    `Current Business Type: ${body.currentBusiness ?? '-'}`,
    `Monthly Distribution Capacity: ${body.monthlyCapacity ?? '-'}`,
    `Distribution Experience: ${body.experience ?? '-'}`,
    '',
    'Additional information:',
    String(body.description ?? '').trim() || '(none)',
  ].join('\n')
}

function buildSupplierEmailBody(body: Record<string, unknown>): string {
  const products = Array.isArray(body.products) ? (body.products as string[]).join(', ') : String(body.products ?? '')
  return [
    'New Supplier Application',
    '========================',
    `Name: ${body.name ?? '-'}`,
    `Phone: ${body.phone ?? '-'}`,
    `Email: ${body.email ?? '-'}`,
    `Company: ${body.company ?? '-'}`,
    `Products: ${products || '-'}`,
    '',
    'Additional information:',
    String(body.description ?? '').trim() || '(none)',
  ].join('\n')
}

function row(label: string, value: string) {
  const v = (value || '—').trim()
  return `<tr><td style="padding:12px 20px;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;width:1%;white-space:nowrap;border-bottom:1px solid #e2e8f0;background:#f8fafc;">${label}</td><td style="padding:12px 20px;color:#0f172a;font-size:15px;line-height:1.5;border-bottom:1px solid #e2e8f0;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;max-width:100%;">${escapeHtml(v)}</td></tr>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDistributorHtml(body: Record<string, unknown>): string {
  const title = 'New Distributor Application'
  const fields = [
    row('Full name', String(body.name ?? '')),
    row('Phone', String(body.phone ?? '')),
    row('Email', String(body.email ?? '')),
    row('Company', String(body.company ?? '')),
    row('Location', String(body.location ?? '')),
    row('Preferred distribution area', String(body.distributionArea ?? '')),
    row('Current business type', String(body.currentBusiness ?? '')),
    row('Monthly distribution capacity', String(body.monthlyCapacity ?? '')),
    row('Distribution experience', String(body.experience ?? '')),
  ].join('')
  const description = String(body.description ?? '').trim() || '—'
  return emailTemplate(title, fields, description, 'Distributor')
}

function buildSupplierHtml(body: Record<string, unknown>): string {
  const title = 'New Supplier Application'
  const products = Array.isArray(body.products)
    ? (body.products as string[]).join(', ')
    : String(body.products ?? '')
  const fields = [
    row('Full name', String(body.name ?? '')),
    row('Phone', String(body.phone ?? '')),
    row('Email', String(body.email ?? '')),
    row('Company', String(body.company ?? '')),
    row('Products', products),
  ].join('')
  const description = String(body.description ?? '').trim() || '—'
  return emailTemplate(title, fields, description, 'Supplier')
}

function emailTemplate(title: string, fieldsTable: string, additionalInfo: string, formType: string): string {
  const safeInfo = escapeHtml(additionalInfo).replace(/\n/g, '<br>')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Infusion Jaba</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.95);font-size:16px;">${escapeHtml(title)}</p>
    </div>
    <div style="padding:0;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;" cellpadding="0" cellspacing="0">
        <tbody>
          ${fieldsTable}
        </tbody>
      </table>
      <div style="padding:20px 24px;border-top:1px solid #e2e8f0;">
        <p style="margin:0 0 10px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Additional information</p>
        <div style="color:#0f172a;font-size:15px;line-height:1.6;">${safeInfo}</div>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:13px;">${formType} form · Infusion Jaba website</p>
    </div>
  </div>
</body>
</html>`
}

/** GET: test SMTP connection (verify). No auth sent; returns host/port/secure and verify result. */
export async function GET() {
  try {
    if (!SMTP_EMAIL || !SMTP_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'SMTP_EMAIL and SMTP_PASSWORD required in .env' },
        { status: 500 }
      )
    }
    const transporter = getTransporter()
    await transporter.verify()
    return NextResponse.json({
      success: true,
      message: 'SMTP connection OK',
      config: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        requireTLS: SMTP_PORT === 587,
      },
    })
  } catch (error) {
    console.error('[submit-form] verify error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const isTimeout = /timeout|ETIMEDOUT|CONN/i.test(msg)
    return NextResponse.json(
      {
        success: false,
        error: msg,
        config: { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465 },
        hint: isTimeout
          ? 'Connection timeout → run in PowerShell: Test-NetConnection ' + SMTP_HOST + ' -Port ' + SMTP_PORT + '. If TcpTestSucceeded=False, your network/ISP is blocking SMTP.'
          : 'Check credentials and TLS (465=secure:true, 587=secure:false+requireTLS:true).',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!SMTP_EMAIL || !SMTP_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Email not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const type = body.type as string

    if (type !== 'distributor' && type !== 'supplier') {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Use "distributor" or "supplier".' },
        { status: 400 }
      )
    }

    const subject =
      type === 'distributor'
        ? `[Jaba Distributor] Application from ${body.name ?? 'Unknown'}`
        : `[Supplier] Application from ${body.name ?? 'Unknown'}`
    const text =
      type === 'distributor' ? buildDistributorEmailBody(body) : buildSupplierEmailBody(body)
    const html =
      type === 'distributor' ? buildDistributorHtml(body) : buildSupplierHtml(body)

    const transporter = getTransporter()
    await transporter.sendMail({
      from: `"Infusion Jaba Forms" <${SMTP_EMAIL}>`,
      to: FORM_SUBMISSION_TO,
      replyTo: REPLY_TO || undefined,
      subject,
      text,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[submit-form] Error sending email:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send submission' },
      { status: 500 }
    )
  }
}
