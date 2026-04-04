import { MongoClient, MongoClientOptions } from 'mongodb'
import { wrapClientWithSync } from './db-sync'

const isDevelopment = process.env.NODE_ENV === 'development'
const allowOfflineDev = isDevelopment && process.env.ALLOW_OFFLINE_DEV === 'true'

if (!process.env.MONGODB_URI && !allowOfflineDev) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/infusion_jaba_dev'

// Enhanced connection options to handle DNS and connection issues
const options: MongoClientOptions = {
  serverSelectionTimeoutMS: 30000, // Increased to 30s for DNS resolution
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000, // Increased to 30s
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 1, // Maintain at least 1 socket connection
  maxIdleTimeMS: 30000,
  // DNS and connection retry options
  heartbeatFrequencyMS: 10000,
  // Try to resolve DNS issues
  directConnection: false,
  // Add these to help with connection stability
  compressors: ['zlib'],
  zlibCompressionLevel: 6,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    
    // Enhanced connection with better error handling and logging
    globalWithMongo._mongoClientPromise = (async () => {
      try {
        console.log('[MongoDB] 🔌 Attempting to connect to MongoDB...')
        await client.connect()
        console.log('[MongoDB] ✅ Connected successfully')
        
        // Verify connection with ping
        await client.db('admin').command({ ping: 1 })
        console.log('[MongoDB] ✅ Connection verified')
        return client
      } catch (error: any) {
        console.error('[MongoDB] ❌ Connection failed:', error.message)
        if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
          console.error('[MongoDB] 💡 DNS Resolution Issue!')
          console.error('[MongoDB] 💡 Solutions:')
          console.error('[MongoDB]    1. Check MongoDB Atlas → Network Access (IP whitelist)')
          console.error('[MongoDB]    2. Verify cluster is running (not paused)')
          console.error('[MongoDB]    3. Try Standard Connection String instead of SRV')
          console.error('[MongoDB]    4. Check firewall/antivirus settings')
        }
        if (allowOfflineDev) {
          console.warn('[MongoDB] ⚠️ ALLOW_OFFLINE_DEV is enabled; continuing in offline dev mode.')
          console.warn('[MongoDB] ⚠️ Database-backed APIs may return 500 until MongoDB is reachable.')
          return client
        }
        throw error
      }
    })()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Wrap the primary client promise with the transparent secondary sync proxy.
// Every write that goes through this promise is automatically mirrored to
// SECONDARY_MONGODB_URI after a successful primary write — reads are unchanged.
const syncedClientPromise: Promise<MongoClient> = clientPromise.then(
  wrapClientWithSync,
)

// Helper function to get database
export async function getDatabase(dbName: string = 'infusion_jaba') {
  const client = await syncedClientPromise
  return client.db(dbName)
}

export default syncedClientPromise

