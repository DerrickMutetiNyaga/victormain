/**
 * M-Pesa API Utility Library
 * Handles authentication, STK Push, and C2B operations
 */

export interface MpesaConfig {
  consumerKey: string
  consumerSecret: string
  passkey: string
  shortcode: string
  environment: 'sandbox' | 'production'
  callbackUrl?: string
}

export interface STKPushRequest {
  phoneNumber: string
  amount: number
  accountReference: string
  transactionDesc?: string
}

export interface STKPushResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
}

export interface C2BValidationRequest {
  TransactionType: string
  TransID: string
  TransTime: string
  TransAmount: string
  BusinessShortCode: string
  BillRefNumber: string
  InvoiceNumber?: string
  OrgAccountBalance: string
  ThirdPartyTransID?: string
  MSISDN: string
  FirstName?: string
  MiddleName?: string
  LastName?: string
}

export interface C2BConfirmationRequest extends C2BValidationRequest {
  // Same structure as validation
}

const SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke'
const PRODUCTION_BASE_URL = 'https://api.safaricom.co.ke'

/**
 * Get OAuth access token from M-Pesa API
 */
export async function getMpesaAccessToken(config: MpesaConfig): Promise<string> {
  const baseUrl = config.environment === 'sandbox' ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
  const authUrl = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`
  
  // Validate credentials
  if (!config.consumerKey || !config.consumerSecret) {
    throw new Error('M-Pesa Consumer Key and Consumer Secret are required')
  }
  
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  
  try {
    const response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
      cache: 'no-store', // Ensure we don't use cached responses
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[M-Pesa] Token generation failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: authUrl,
        hasConsumerKey: !!config.consumerKey,
        hasConsumerSecret: !!config.consumerSecret,
      })
      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.access_token) {
      console.error('[M-Pesa] No access token in response:', data)
      throw new Error('Access token not found in M-Pesa response')
    }
    
    return data.access_token
  } catch (error: any) {
    console.error('[M-Pesa] Error getting access token:', error)
    throw new Error(`M-Pesa authentication failed: ${error.message}`)
  }
}

/**
 * Generate password for STK Push (Base64 encoded timestamp + shortcode + passkey)
 */
function generatePassword(shortcode: string, passkey: string): string {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
  const passwordString = `${shortcode}${passkey}${timestamp}`
  return Buffer.from(passwordString).toString('base64')
}

/**
 * Initiate STK Push payment request
 */
export async function initiateSTKPush(
  config: MpesaConfig,
  request: STKPushRequest
): Promise<STKPushResponse> {
  const baseUrl = config.environment === 'sandbox' ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
  const stkUrl = `${baseUrl}/mpesa/stkpush/v1/processrequest`
  
  try {
    const accessToken = await getMpesaAccessToken(config)
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    const password = generatePassword(config.shortcode, config.passkey)
    
    // Format phone number (remove + and ensure it starts with 254)
    let phoneNumber = request.phoneNumber.replace(/\s+/g, '').replace(/^\+/, '')
    if (phoneNumber.startsWith('0')) {
      phoneNumber = `254${phoneNumber.slice(1)}`
    } else if (!phoneNumber.startsWith('254')) {
      phoneNumber = `254${phoneNumber}`
    }

    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: Math.round(request.amount),
      PartyA: phoneNumber,
      PartyB: '5694492',
      PhoneNumber: phoneNumber,
      CallBackURL: config.callbackUrl || `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mpesa/callback`,
      AccountReference: request.accountReference,
      TransactionDesc: request.transactionDesc || 'Payment',
    }

    const response = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`STK Push failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (data.ResponseCode !== '0') {
      throw new Error(`STK Push error: ${data.ResponseDescription || data.errorMessage || 'Unknown error'}`)
    }

    return {
      MerchantRequestID: data.MerchantRequestID,
      CheckoutRequestID: data.CheckoutRequestID,
      ResponseCode: data.ResponseCode,
      ResponseDescription: data.ResponseDescription,
      CustomerMessage: data.CustomerMessage,
    }
  } catch (error: any) {
    console.error('[M-Pesa] STK Push error:', error)
    throw error
  }
}

/**
 * Query STK Push status
 */
export async function querySTKPushStatus(
  config: MpesaConfig,
  checkoutRequestId: string
): Promise<any> {
  const baseUrl = config.environment === 'sandbox' ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
  const queryUrl = `${baseUrl}/mpesa/stkpushquery/v1/query`
  
  try {
    const accessToken = await getMpesaAccessToken(config)
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    const password = generatePassword(config.shortcode, config.passkey)

    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`STK Query failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  } catch (error: any) {
    console.error('[M-Pesa] STK Query error:', error)
    throw error
  }
}

/**
 * Register C2B URLs (Validation and Confirmation)
 */
export async function registerC2BUrls(
  config: MpesaConfig,
  validationUrl: string,
  confirmationUrl: string
): Promise<any> {
  const baseUrl = config.environment === 'sandbox' ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
  const registerUrl = `${baseUrl}/mpesa/c2b/v2/registerurl`
  
  try {
    // Validate required fields
    if (!config.shortcode) {
      throw new Error('M-Pesa Shortcode is required')
    }
    if (!validationUrl || !confirmationUrl) {
      throw new Error('Validation URL and Confirmation URL are required')
    }

    // Get fresh access token
    console.log('[M-Pesa] Generating access token for C2B URL registration...')
    const accessToken = await getMpesaAccessToken(config)
    
    if (!accessToken) {
      throw new Error('Failed to obtain access token')
    }
    
    console.log('[M-Pesa] Access token obtained, registering C2B URLs...')

    const payload = {
      ShortCode: config.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    }

    console.log('[M-Pesa] C2B Registration Payload:', {
      ShortCode: config.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
      Environment: config.environment,
    })

    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('[M-Pesa] C2B URL registration failed:', {
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        url: registerUrl,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length,
      })
      throw new Error(`C2B URL registration failed: ${response.status} - ${responseText}`)
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      result = { raw: responseText }
    }

    console.log('[M-Pesa] C2B URLs registered successfully:', result)
    return result
  } catch (error: any) {
    console.error('[M-Pesa] C2B URL registration error:', error)
    throw error
  }
}

