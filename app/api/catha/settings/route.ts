import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { auth } from '@/lib/auth-catha'
import { normalizePermissions, hasCathaPermission } from '@/lib/catha-permissions-model'

export interface Settings {
  _id?: string
  businessInfo?: {
    businessName: string
    phone: string
    address: string
    currency: string
    vatRate: number
  }
  receipt?: {
    autoPrint: boolean
    includeVatBreakdown: boolean
    footerMessage: string
  }
  notifications?: {
    lowStockAlerts: boolean
    dailySalesSummary: boolean
    newOrderNotifications: boolean
    supplierDeliveryReminders: boolean
  }
  security?: {
    requirePinForVoids: boolean
    autoLogout: string
    twoFactorAuth: boolean
  }
  etims?: {
    enabled: boolean
    environment: 'sandbox' | 'production'
    taxpayerPin: string
    branchOfficeId: string
    communicationKey: string
    equipmentInfo?: string
  }
  mpesa?: {
    enabled: boolean
    environment: 'sandbox' | 'production'
    consumerKey: string
    consumerSecret: string
    passkey: string
    shortcode: string
    confirmationUrl: string
    validationUrl: string
    callbackUrl: string
  }
  delivery?: {
    pickupAddress: string
    pickupDirectionsUrl?: string
    options: Array<{
      value: string
      label: string
      fee: number
      subtext: string
      enabled: boolean
    }>
  }
  createdAt?: Date
  updatedAt?: Date
}

// Default settings
const defaultSettings: Settings = {
  businessInfo: {
    businessName: 'Catha Lounge',
    phone: '+254 712 345678',
    address: 'Westlands, Nairobi, Kenya',
    currency: 'kes',
    vatRate: 16,
  },
  receipt: {
    autoPrint: true,
    includeVatBreakdown: true,
    footerMessage: 'Thank you for visiting!',
  },
  notifications: {
    lowStockAlerts: true,
    dailySalesSummary: true,
    newOrderNotifications: false,
    supplierDeliveryReminders: true,
  },
  security: {
    requirePinForVoids: true,
    autoLogout: '15',
    twoFactorAuth: false,
  },
  etims: {
    enabled: false,
    environment: 'sandbox',
    taxpayerPin: '',
    branchOfficeId: '',
    communicationKey: '',
    equipmentInfo: '',
  },
  mpesa: {
    enabled: false,
    environment: 'sandbox',
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    shortcode: '',
    confirmationUrl: '',
    validationUrl: '',
    callbackUrl: '',
  },
  delivery: {
    pickupAddress: 'Catha Lounge – Nairobi (exact address confirmed at order)',
    pickupDirectionsUrl: '',
    options: [
      { value: 'deliver_to_my_location', label: 'Deliver to My Location', fee: 350, subtext: 'Delivery fee applies', enabled: true },
      { value: 'collect_at_catha_lodge', label: 'Collect at Catha Lounge', fee: 0, subtext: 'No delivery fee', enabled: true },
      { value: 'nairobi_cbd', label: 'Deliver within Nairobi CBD', fee: 200, subtext: 'KES 200 delivery', enabled: true },
      { value: 'westlands', label: 'Deliver within Westlands', fee: 200, subtext: 'KES 200 delivery', enabled: true },
      { value: 'kilimani', label: 'Deliver within Kilimani', fee: 200, subtext: 'KES 200 delivery', enabled: true },
    ],
  },
}

export async function GET() {
  // Public: allows unauthenticated callers (checkout, delivery options).

  try {
    const db = await getDatabase('infusion_jaba')
    const settings = await db.collection<Settings>('catha_settings').findOne({})
    
    if (!settings) {
      // Return default settings
      return NextResponse.json({
        success: true,
        settings: defaultSettings,
      })
    }
    
    // Check if we need to migrate old US values to Kenyan defaults
    const oldPhone = '+1 555-0100'
    const oldAddress = '123 Nightlife Ave, Downtown, NY 10001'
    let needsMigration = false
    
    if (settings.businessInfo) {
      if (settings.businessInfo.phone === oldPhone || settings.businessInfo.address === oldAddress) {
        needsMigration = true
        // Update to Kenyan defaults
        if (settings.businessInfo.phone === oldPhone) {
          settings.businessInfo.phone = defaultSettings.businessInfo!.phone
        }
        if (settings.businessInfo.address === oldAddress) {
          settings.businessInfo.address = defaultSettings.businessInfo!.address
        }
      }
    }
    
    // Auto-migrate if needed
    let updatedTimestamp = settings.updatedAt
    if (needsMigration) {
      const updatedDoc = await db.collection<Settings>('catha_settings').findOneAndUpdate(
        { _id: settings._id },
        { 
          $set: { 
            businessInfo: settings.businessInfo,
            updatedAt: new Date(),
          } 
        },
        { returnDocument: 'after' }
      )
      if (updatedDoc) {
        updatedTimestamp = updatedDoc.updatedAt
      }
    }
    
    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      businessInfo: { ...defaultSettings.businessInfo, ...(settings.businessInfo || {}) },
      receipt: { ...defaultSettings.receipt, ...(settings.receipt || {}) },
      notifications: { ...defaultSettings.notifications, ...(settings.notifications || {}) },
      security: { ...defaultSettings.security, ...(settings.security || {}) },
      etims: { ...defaultSettings.etims, ...(settings.etims || {}) },
      mpesa: { ...defaultSettings.mpesa, ...(settings.mpesa || {}) },
      delivery: { ...defaultSettings.delivery, ...(settings.delivery || {}) },
      _id: settings._id,
      createdAt: settings.createdAt,
      updatedAt: updatedTimestamp,
    }
    
    return NextResponse.json({
      success: true,
      settings: mergedSettings,
    })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings', message: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role ?? '').toUpperCase()
  const perms = normalizePermissions((session.user as any).permissions)
  if (role !== 'SUPER_ADMIN' && !hasCathaPermission(perms, 'settings', 'edit')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const db = await getDatabase('infusion_jaba')
    
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (body.businessInfo !== undefined) {
      updateData.businessInfo = body.businessInfo
    }
    if (body.receipt !== undefined) {
      updateData.receipt = body.receipt
    }
    if (body.notifications !== undefined) {
      updateData.notifications = body.notifications
    }
    if (body.security !== undefined) {
      updateData.security = body.security
    }
    if (body.etims !== undefined) {
      updateData.etims = body.etims
    }
    if (body.mpesa !== undefined) {
      updateData.mpesa = body.mpesa
    }
    if (body.delivery !== undefined) {
      updateData.delivery = body.delivery
    }
    
    // Set createdAt on first creation
    const existing = await db.collection<Settings>('catha_settings').findOne({})
    if (!existing) {
      updateData.createdAt = new Date()
    }
    
    // Upsert the settings (create if doesn't exist, update if exists)
    const result = await db.collection<Settings>('catha_settings').findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    )
    
    return NextResponse.json({ success: true, settings: result })
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update settings', message: error.message },
      { status: 500 }
    )
  }
}

