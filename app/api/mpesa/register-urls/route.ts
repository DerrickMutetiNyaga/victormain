import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { registerC2BUrls, type MpesaConfig } from '@/lib/mpesa'

export async function POST(request: Request) {
  try {
    const db = await getDatabase('infusion_jaba')
    const settings = await db.collection('catha_settings').findOne({})

    if (!settings?.mpesa?.enabled) {
      return NextResponse.json(
        { success: false, error: 'M-Pesa gateway is not enabled' },
        { status: 400 }
      )
    }

    // Get base URL - prefer NEXTAUTH_URL (production URL), then NEXT_PUBLIC_BASE_URL, then default
    let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    // Ensure HTTPS in production (M-Pesa requires HTTPS for production URLs)
    if (settings.mpesa.environment === 'production' && !baseUrl.startsWith('https://')) {
      console.warn('[M-Pesa] Warning: Production environment requires HTTPS URLs')
      // Try to convert to HTTPS if we have a domain
      if (baseUrl.includes('infusionjaba.co.ke')) {
        baseUrl = baseUrl.replace('http://', 'https://')
      }
    }
    
    const validationUrl = settings.mpesa.validationUrl || `${baseUrl}/api/c2b/validation`
    const confirmationUrl = settings.mpesa.confirmationUrl || `${baseUrl}/api/c2b/confirmation`
    
    // Validate URLs are HTTPS in production
    if (settings.mpesa.environment === 'production') {
      if (!validationUrl.startsWith('https://') || !confirmationUrl.startsWith('https://')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Production environment requires HTTPS URLs. Please ensure your URLs start with https://' 
          },
          { status: 400 }
        )
      }
    }

    // Validate required M-Pesa settings
    if (!settings.mpesa.consumerKey || !settings.mpesa.consumerSecret) {
      return NextResponse.json(
        { success: false, error: 'M-Pesa Consumer Key and Consumer Secret are required' },
        { status: 400 }
      )
    }

    if (!settings.mpesa.shortcode) {
      return NextResponse.json(
        { success: false, error: 'M-Pesa Shortcode is required' },
        { status: 400 }
      )
    }

    console.log("[M-Pesa Register URLs] Configuration:", {
      hasConsumerKey: !!settings.mpesa.consumerKey,
      hasConsumerSecret: !!settings.mpesa.consumerSecret,
      shortcode: settings.mpesa.shortcode,
      environment: settings.mpesa.environment,
      validationUrl,
      confirmationUrl,
    })

    const mpesaConfig: MpesaConfig = {
      consumerKey: settings.mpesa.consumerKey,
      consumerSecret: settings.mpesa.consumerSecret,
      passkey: settings.mpesa.passkey,
      shortcode: settings.mpesa.shortcode,
      environment: settings.mpesa.environment,
    }

    const result = await registerC2BUrls(mpesaConfig, validationUrl, confirmationUrl)

    return NextResponse.json({
      success: true,
      message: 'C2B URLs registered successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('[M-Pesa Register URLs] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register C2B URLs' },
      { status: 500 }
    )
  }
}

