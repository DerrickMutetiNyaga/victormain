import 'dotenv/config'
import { getDatabase } from '../lib/mongodb'

async function seedOrders() {
  try {
    console.log('🌱 Seeding orders...')
    
    const db = await getDatabase('infusion_jaba')
    const ordersCollection = db.collection('orders')
    
    // Clear existing orders
    await ordersCollection.deleteMany({})
    console.log('✅ Cleared existing orders')
    
    // Create 3 sample orders
    const orders = [
      {
        id: 'TXN001',
        table: 5,
        items: [
          { productId: 'wh001', name: 'Johnnie Walker Black', quantity: 2, price: 850 },
          { productId: 'be001', name: 'Tusker Lager', quantity: 4, price: 150 },
        ],
        subtotal: 2300,
        vat: 368,
        total: 2668,
        paymentMethod: 'cash',
        cashier: 'Marcus Johnson',
        waiter: 'Sarah Kimani',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'completed',
      },
      {
        id: 'TXN002',
        table: 12,
        items: [
          { productId: 'vo001', name: 'Grey Goose', quantity: 1, price: 920 },
          { productId: 'so001', name: 'Coca Cola', quantity: 3, price: 80 },
        ],
        subtotal: 1160,
        vat: 185.6,
        total: 1345.6,
        paymentMethod: 'mpesa',
        cashier: 'Marcus Johnson',
        waiter: 'David Ochieng',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        status: 'completed',
      },
      {
        id: 'TXN003',
        table: 8,
        items: [
          { productId: 'wi001', name: 'Chardonnay', quantity: 2, price: 1200 },
          { productId: 'co001', name: 'Mojito', quantity: 3, price: 450 },
        ],
        subtotal: 3750,
        vat: 600,
        total: 4350,
        paymentMethod: 'card',
        cashier: 'Marcus Johnson',
        waiter: 'Grace Wanjiru',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        status: 'pending',
      },
    ]
    
    await ordersCollection.insertMany(orders)
    console.log(`✅ Seeded ${orders.length} orders`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding orders:', error)
    process.exit(1)
  }
}

seedOrders()

