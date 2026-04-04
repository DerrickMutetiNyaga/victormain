import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireCathaPermission } from '@/lib/auth-catha'

// KRA eTIMS API base URLs
const ETIMS_BASE_URLS = {
  sandbox: 'https://etims-api-sbx.kra.go.ke',
  production: 'https://etims-api.kra.go.ke',
}

export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermission('system.settings', 'edit')
  if (!allowed && response) return response
  try {
    const body = await request.json()
    const { taxpayerPin, branchOfficeId, equipmentInfo, environment = 'sandbox' } = body

    // Validate required fields
    if (!taxpayerPin || !branchOfficeId) {
      return NextResponse.json(
        { success: false, error: 'Taxpayer PIN and Branch Office ID are required' },
        { status: 400 }
      )
    }

    // Get base URL based on environment
    const baseUrl = ETIMS_BASE_URLS[environment as keyof typeof ETIMS_BASE_URLS] || ETIMS_BASE_URLS.sandbox

    // OSCU initialization endpoint
    const initEndpoint = '/selectInitOsdcInfo'

    // Prepare request payload for OSCU initialization
    const initPayload = {
      taxpayerPin: taxpayerPin.trim(),
      branchOfficeId: branchOfficeId.trim(),
      equipmentInfo: equipmentInfo?.trim() || '',
    }

    console.log(`[eTIMS] Initializing OSCU for PIN: ${taxpayerPin}, Branch: ${branchOfficeId}, Environment: ${environment}`)

    try {
      // Call KRA eTIMS API for OSCU initialization
      const response = await fetch(`${baseUrl}${initEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(initPayload),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error('[eTIMS] OSCU initialization failed:', responseData)
        return NextResponse.json(
          { 
            success: false, 
            error: responseData.message || responseData.error || 'Failed to initialize OSCU',
            details: responseData 
          },
          { status: response.status }
        )
      }

      // Extract communication key from response
      // Note: The actual response structure may vary based on KRA API specification
      const communicationKey = responseData.communicationKey || 
                               responseData.data?.communicationKey || 
                               responseData.result?.communicationKey

      if (communicationKey) {
        // Save settings to database
        const db = await getDatabase('infusion_jaba')
        await db.collection('catha_settings').findOneAndUpdate(
          {},
          {
            $set: {
              'etims.taxpayerPin': taxpayerPin.trim(),
              'etims.branchOfficeId': branchOfficeId.trim(),
              'etims.communicationKey': communicationKey,
              'etims.environment': environment,
              'etims.equipmentInfo': equipmentInfo?.trim() || '',
              'etims.enabled': true,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        )

        console.log('[eTIMS] OSCU initialized successfully, Communication Key retrieved')

        return NextResponse.json({
          success: true,
          message: 'OSCU initialized successfully',
          communicationKey: communicationKey,
          environment: environment,
        })
      } else {
        // Response successful but no communication key yet (may require additional steps)
        console.log('[eTIMS] OSCU initialization initiated, awaiting communication key')

        return NextResponse.json({
          success: true,
          message: 'OSCU initialization process started. Please check KRA portal for communication key.',
          response: responseData,
        })
      }
    } catch (fetchError: any) {
      console.error('[eTIMS] Network error during OSCU initialization:', fetchError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to connect to KRA eTIMS API',
          details: fetchError.message 
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[eTIMS] Error in OSCU initialization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize OSCU', message: error.message },
      { status: 500 }
    )
  }
}

