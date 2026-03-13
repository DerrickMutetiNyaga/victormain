import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const DB_NAME = 'infusion_jaba'
const COLLECTION = 'shop_carts'

export interface CartItemDoc {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  size?: string
}

export interface ShopCart {
  _id?: ObjectId
  customerId: ObjectId
  items: CartItemDoc[]
  updatedAt: Date
}

export async function getCartByCustomerId(customerId: ObjectId): Promise<ShopCart | null> {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const cart = await db.collection<ShopCart>(COLLECTION).findOne({ customerId })
    return cart
  } catch (error) {
    console.error('[ShopCart] Error fetching cart:', error)
    return null
  }
}

export async function upsertCart(customerId: ObjectId, items: CartItemDoc[]): Promise<ShopCart> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  const now = new Date()
  const result = await db.collection<ShopCart>(COLLECTION).findOneAndUpdate(
    { customerId },
    { $set: { items, updatedAt: now } },
    { upsert: true, returnDocument: 'after' }
  )
  return result as ShopCart
}

export async function clearCart(customerId: ObjectId): Promise<void> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  await db.collection<ShopCart>(COLLECTION).deleteOne({ customerId })
}
