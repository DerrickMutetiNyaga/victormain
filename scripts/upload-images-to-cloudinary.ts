import 'dotenv/config'
import { v2 as cloudinary } from 'cloudinary'
import * as fs from 'fs'
import * as path from 'path'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

const publicDir = path.join(process.cwd(), 'public')

async function uploadImage(filePath: string, folder: string = 'jaba'): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    })
    console.log(`✓ Uploaded: ${path.basename(filePath)} -> ${result.secure_url}`)
    return result.secure_url
  } catch (error) {
    console.error(`✗ Failed to upload ${filePath}:`, error)
    return null
  }
}

async function uploadAllImages() {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  const uploadedUrls: Record<string, string> = {}

  console.log('Starting image upload to Cloudinary...\n')

  // Read all files in public directory recursively
  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir)
    files.forEach((file) => {
      const filePath = path.join(dir, file)
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList)
      } else {
        fileList.push(filePath)
      }
    })
    return fileList
  }

  const files = getAllFiles(publicDir)

  for (const filePath of files) {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) continue

    const ext = path.extname(filePath).toLowerCase()

    if (imageExtensions.includes(ext)) {
      const url = await uploadImage(filePath, 'jaba')
      if (url) {
        // Store relative path -> Cloudinary URL mapping
        const relativePath = path.relative(publicDir, filePath).replace(/\\/g, '/')
        uploadedUrls[relativePath] = url
      }
    }
  }

  // Save mapping to a JSON file for reference
  const mappingPath = path.join(process.cwd(), 'cloudinary-mapping.json')
  fs.writeFileSync(mappingPath, JSON.stringify(uploadedUrls, null, 2))
  console.log(`\n✓ Saved URL mapping to ${mappingPath}`)
  console.log(`\n✅ Upload completed! Total images uploaded: ${Object.keys(uploadedUrls).length}`)
  
  return uploadedUrls
}

uploadAllImages()
  .then(() => {
    console.log('Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

