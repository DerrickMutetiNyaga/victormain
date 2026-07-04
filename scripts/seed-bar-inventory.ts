import 'dotenv/config'
import { v2 as cloudinary } from 'cloudinary'
import clientPromise from '../lib/mongodb'
import * as fs from 'fs'
import * as path from 'path'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

const publicDir = path.join(process.cwd(), 'public')

// ALL products with images from dummy data
const productsToSeed = [
  // Whiskey
  {
    name: "Johnnie Walker Black",
    category: "whiskey",
    price: 850,
    cost: 620,
    stock: 24,
    minStock: 10,
    image: "/johnnie-walker-black-label-whiskey-bottle.jpg",
    barcode: "5000267024202",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Premium blended Scotch whisky",
  },
  {
    name: "Jack Daniels",
    category: "whiskey",
    price: 750,
    cost: 540,
    stock: 18,
    minStock: 8,
    image: "/jack-daniels-tennessee-whiskey-bottle.jpg",
    barcode: "5099873089798",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Tennessee whiskey",
  },
  {
    name: "Jameson Irish",
    category: "whiskey",
    price: 680,
    cost: 480,
    stock: 15,
    minStock: 8,
    image: "/jameson-whiskey-bottle.png",
    barcode: "5011007003005",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Irish whiskey",
  },
  {
    name: "Glenfiddich 12yr",
    category: "whiskey",
    price: 1200,
    cost: 880,
    stock: 8,
    minStock: 5,
    image: "/glenfiddich-12-year-scotch-whiskey.jpg",
    barcode: "5010327000176",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Single malt Scotch whisky",
  },
  {
    name: "Chivas Regal 12yr",
    category: "whiskey",
    price: 950,
    cost: 700,
    stock: 12,
    minStock: 6,
    image: "/chivas-regal-12-year-scotch-whiskey.jpg",
    barcode: "5000299225028",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Blended Scotch whisky",
  },
  // Vodka
  {
    name: "Grey Goose",
    category: "vodka",
    price: 920,
    cost: 680,
    stock: 20,
    minStock: 10,
    image: "/grey-goose-vodka-bottle-premium.jpg",
    barcode: "5010677850001",
    unit: "bottle",
    size: "750ml",
    supplier: "Global Beverages",
    notes: "Premium French vodka",
  },
  {
    name: "Absolut Original",
    category: "vodka",
    price: 580,
    cost: 420,
    stock: 28,
    minStock: 12,
    image: "/absolut-vodka-bottle.jpg",
    barcode: "7312040017010",
    unit: "bottle",
    size: "750ml",
    supplier: "Global Beverages",
    notes: "Swedish vodka",
  },
  {
    name: "Belvedere",
    category: "vodka",
    price: 1100,
    cost: 820,
    stock: 10,
    minStock: 5,
    image: "/belvedere-vodka-premium-bottle.jpg",
    barcode: "5901041003096",
    unit: "bottle",
    size: "750ml",
    supplier: "Global Beverages",
    notes: "Polish premium vodka",
  },
  {
    name: "Smirnoff Red",
    category: "vodka",
    price: 420,
    cost: 280,
    stock: 35,
    minStock: 15,
    image: "/smirnoff-red-vodka-bottle.jpg",
    barcode: "5410316966001",
    unit: "bottle",
    size: "750ml",
    supplier: "Global Beverages",
    notes: "Russian vodka",
  },
  {
    name: "Ciroc",
    category: "vodka",
    price: 980,
    cost: 720,
    stock: 14,
    minStock: 6,
    image: "/ciroc-vodka.png",
    barcode: "0088076174559",
    unit: "bottle",
    size: "750ml",
    supplier: "Global Beverages",
    notes: "French vodka made from grapes",
  },
  // Rum
  {
    name: "Bacardi Superior",
    category: "rum",
    price: 520,
    cost: 360,
    stock: 22,
    minStock: 10,
    image: "/bacardi-superior-white-rum.png",
    barcode: "5010677850001",
    unit: "bottle",
    size: "750ml",
    supplier: "Caribbean Imports",
    notes: "White rum",
  },
  {
    name: "Captain Morgan",
    category: "rum",
    price: 580,
    cost: 400,
    stock: 18,
    minStock: 8,
    image: "/captain-morgan-spiced-rum-bottle.jpg",
    barcode: "0087000003293",
    unit: "bottle",
    size: "750ml",
    supplier: "Caribbean Imports",
    notes: "Spiced rum",
  },
  {
    name: "Havana Club 7yr",
    category: "rum",
    price: 720,
    cost: 520,
    stock: 12,
    minStock: 6,
    image: "/havana-club-7-year-rum-bottle.jpg",
    barcode: "8501110080439",
    unit: "bottle",
    size: "750ml",
    supplier: "Caribbean Imports",
    notes: "Aged Cuban rum",
  },
  {
    name: "Appleton Estate",
    category: "rum",
    price: 680,
    cost: 480,
    stock: 15,
    minStock: 6,
    image: "/appleton-estate-jamaica-rum-bottle.jpg",
    barcode: "5024576182700",
    unit: "bottle",
    size: "750ml",
    supplier: "Caribbean Imports",
    notes: "Jamaican rum",
  },
  // Gin
  {
    name: "Tanqueray",
    category: "gin",
    price: 620,
    cost: 440,
    stock: 16,
    minStock: 8,
    image: "/tanqueray-gin-bottle.jpg",
    barcode: "5000281005393",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "London dry gin",
  },
  {
    name: "Hendricks",
    category: "gin",
    price: 880,
    cost: 650,
    stock: 10,
    minStock: 5,
    image: "/hendricks-gin-bottle.jpg",
    barcode: "5010327705019",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Scottish gin with cucumber and rose",
  },
  {
    name: "Bombay Sapphire",
    category: "gin",
    price: 680,
    cost: 480,
    stock: 14,
    minStock: 6,
    image: "/bombay-sapphire-gin.png",
    barcode: "5010677714006",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "Premium gin",
  },
  {
    name: "Beefeater",
    category: "gin",
    price: 540,
    cost: 380,
    stock: 20,
    minStock: 10,
    image: "/beefeater-london-dry-gin-bottle.jpg",
    barcode: "5000329002292",
    unit: "bottle",
    size: "750ml",
    supplier: "Premium Spirits Ltd",
    notes: "London dry gin",
  },
  // Beer
  {
    name: "Heineken",
    category: "beer",
    price: 280,
    cost: 180,
    stock: 120,
    minStock: 50,
    image: "/heineken-beer-bottle.jpg",
    barcode: "8712000022603",
    unit: "bottle",
    size: "500ml",
    supplier: "Global Beverages",
    notes: "Premium lager beer",
  },
  {
    name: "Corona Extra",
    category: "beer",
    price: 300,
    cost: 190,
    stock: 100,
    minStock: 40,
    image: "/corona-extra-beer-bottle.jpg",
    barcode: "7501064191091",
    unit: "bottle",
    size: "330ml",
    supplier: "Global Beverages",
    notes: "Mexican lager beer",
  },
  {
    name: "Budweiser",
    category: "beer",
    price: 250,
    cost: 160,
    stock: 144,
    minStock: 60,
    image: "/budweiser-beer-bottle.jpg",
    barcode: "0018200007248",
    unit: "bottle",
    size: "500ml",
    supplier: "Global Beverages",
    notes: "American lager",
  },
  {
    name: "Guinness Stout",
    category: "beer",
    price: 320,
    cost: 210,
    stock: 80,
    minStock: 35,
    image: "/guinness-stout-beer-bottle.jpg",
    barcode: "5000213006000",
    unit: "bottle",
    size: "500ml",
    supplier: "Global Beverages",
    notes: "Irish dry stout",
  },
  // Cocktails
  {
    name: "Mojito",
    category: "cocktails",
    price: 450,
    cost: 180,
    stock: 50,
    minStock: 20,
    image: "/custom-drink.jpg",
    barcode: "COCK001",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Classic mint and lime cocktail",
  },
  {
    name: "Margarita",
    category: "cocktails",
    price: 480,
    cost: 200,
    stock: 45,
    minStock: 18,
    image: "/custom-drink.jpg",
    barcode: "COCK002",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Tequila, lime, and triple sec",
  },
  {
    name: "Old Fashioned",
    category: "cocktails",
    price: 520,
    cost: 220,
    stock: 40,
    minStock: 15,
    image: "/custom-drink.jpg",
    barcode: "COCK003",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Whiskey, sugar, and bitters",
  },
  {
    name: "Cosmopolitan",
    category: "cocktails",
    price: 500,
    cost: 210,
    stock: 42,
    minStock: 16,
    image: "/custom-drink.jpg",
    barcode: "COCK004",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Vodka, cranberry, and lime",
  },
  {
    name: "Piña Colada",
    category: "cocktails",
    price: 480,
    cost: 190,
    stock: 48,
    minStock: 20,
    image: "/custom-drink.jpg",
    barcode: "COCK005",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Rum, coconut, and pineapple",
  },
  {
    name: "Negroni",
    category: "cocktails",
    price: 550,
    cost: 230,
    stock: 35,
    minStock: 12,
    image: "/custom-drink.jpg",
    barcode: "COCK006",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Gin, vermouth, and Campari",
  },
  {
    name: "Moscow Mule",
    category: "cocktails",
    price: 460,
    cost: 185,
    stock: 46,
    minStock: 18,
    image: "/custom-drink.jpg",
    barcode: "COCK007",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Vodka, ginger beer, and lime",
  },
  {
    name: "Whiskey Sour",
    category: "cocktails",
    price: 490,
    cost: 200,
    stock: 44,
    minStock: 17,
    image: "/custom-drink.jpg",
    barcode: "COCK008",
    unit: "serving",
    size: "250ml",
    supplier: "Cocktail Supplies Co",
    notes: "Whiskey, lemon, and simple syrup",
  },
]

// NOTE: Total Stock Value vs Potential Value
// - Total Stock Value = sum of (cost × stock) = What you paid for inventory
// - Potential Value = sum of (price × stock) = What you can sell it for
// These values should be DIFFERENT - Potential Value should be higher due to markup

async function uploadImageToCloudinary(imagePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(publicDir, imagePath.replace(/^\//, ''))
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Image not found: ${fullPath}`)
      return null
    }

    const result = await cloudinary.uploader.upload(fullPath, {
      folder: 'bar/inventory',
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    })
    
    console.log(`✓ Uploaded: ${imagePath} -> ${result.secure_url}`)
    return result.secure_url
  } catch (error) {
    console.error(`✗ Failed to upload ${imagePath}:`, error)
    return null
  }
}

async function seedBarInventory() {
  try {
    console.log('🌱 Starting bar inventory seeding...\n')

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db('infusion_jaba')

    // Clear existing bar inventory (optional - comment out if you want to keep existing data)
    const deleteResult = await db.collection('bar_inventory').deleteMany({ type: 'bar' })
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing bar inventory items\n`)

    let successCount = 0
    let failCount = 0

    // Process each product
    for (const product of productsToSeed) {
      try {
        console.log(`📦 Processing: ${product.name}`)

        // Upload image to Cloudinary
        let imageUrl = ''
        if (product.image) {
          const uploadedUrl = await uploadImageToCloudinary(product.image)
          if (uploadedUrl) {
            imageUrl = uploadedUrl
          } else {
            console.log(`⚠️  Continuing without image for ${product.name}`)
          }
        }

        // Check if product already exists (by name or barcode)
        const existing = await db.collection('bar_inventory').findOne({
          $or: [
            { name: { $regex: new RegExp(`^${product.name.trim()}$`, 'i') } },
            ...(product.barcode ? [{ barcode: product.barcode }] : [])
          ],
          type: 'bar'
        })

        if (existing) {
          console.log(`⏭️  Skipping ${product.name} - already exists\n`)
          continue
        }

        // Prepare inventory item document
        const inventoryData = {
          name: product.name.trim(),
          category: product.category.trim(),
          barcode: product.barcode?.trim() || '',
          cost: Number(product.cost),
          price: Number(product.price),
          stock: Number(product.stock),
          minStock: Number(product.minStock),
          unit: product.unit.trim(),
          size: product.size?.trim() || '',
          supplier: product.supplier.trim(),
          image: imageUrl,
          notes: product.notes?.trim() || '',
          isJaba: false,
          type: 'bar',
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Insert into database
        const result = await db.collection('bar_inventory').insertOne(inventoryData)
        
        console.log(`✅ Created: ${product.name} (ID: ${result.insertedId})`)
        if (imageUrl) {
          console.log(`   Image: ${imageUrl}`)
        }
        console.log('')
        
        successCount++
      } catch (error: any) {
        console.error(`❌ Failed to seed ${product.name}:`, error.message)
        failCount++
        console.log('')
      }
    }

    console.log('\n📊 Seeding Summary:')
    console.log(`✅ Successfully seeded: ${successCount} products`)
    console.log(`❌ Failed: ${failCount} products`)
    console.log(`\n🎉 Bar inventory seeding completed!`)

  } catch (error: any) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

// Run the seeding
seedBarInventory()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
