import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireCathaPermissionAny } from '@/lib/auth-catha'

export const runtime = 'nodejs'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

// POST upload image to Cloudinary - requires tables or inventory edit
export async function POST(request: Request) {
  const { allowed, response } = await requireCathaPermissionAny([
    { permissionKey: 'operations.tables', action: 'edit' },
    { permissionKey: 'inventory.inventory', action: 'edit' },
  ])
  if (!allowed && response) return response
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    console.log('[Bar Image Upload] Uploading image to Cloudinary...')

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Convert buffer to base64 data URL
    const base64 = buffer.toString('base64')
    const dataURI = `data:${file.type};base64,${base64}`

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'bar/tables', // Store in bar/tables folder
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      resource_type: 'image',
    })

    console.log(`[Bar Image Upload] ✅ Image uploaded successfully: ${result.secure_url}`)

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    })
  } catch (error: any) {
    console.error('[Bar Image Upload] ❌ Error uploading image:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error.message || String(error),
      },
      { status: 500 }
    )
  }
}

