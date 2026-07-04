import 'dotenv/config'
import { getDatabase } from '../lib/mongodb'

async function deleteAllOrders() {
  try {
    console.log('🗑️  Deleting all orders...')
    
    const db = await getDatabase('infusion_jaba')
    const ordersCollection = db.collection('orders')
    
    // Count orders before deletion
    const countBefore = await ordersCollection.countDocuments({})
    console.log(`📊 Found ${countBefore} orders in database`)
    
    if (countBefore === 0) {
      console.log('✅ No orders to delete. Database is already empty.')
      process.exit(0)
    }
    
    // Delete all orders
    const result = await ordersCollection.deleteMany({})
    console.log(`✅ Successfully deleted ${result.deletedCount} orders`)
    
    // Verify deletion
    const countAfter = await ordersCollection.countDocuments({})
    console.log(`📊 Orders remaining: ${countAfter}`)
    
    if (countAfter === 0) {
      console.log('✅ All orders have been deleted successfully!')
    } else {
      console.log('⚠️  Warning: Some orders may still exist')
    }
    
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error deleting orders:', error)
    console.error('Error details:', error.message)
    process.exit(1)
  }
}

deleteAllOrders()

