import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

type PackagingAttemptResult = { ok: true; id: string } | { ok: false; reason: string }
type DeliveryAttemptResult = { ok: true; id: string } | { ok: false; reason: string }

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'infusion_jaba'

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment.')
  process.exit(1)
}

const KEEP_DATA = process.argv.includes('--keep')

function nowStamp() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(
    d.getHours()
  ).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
}

async function run() {
  const stamp = nowStamp()
  const client = new MongoClient(MONGODB_URI!, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  })
  const createdIds = {
    batchId: '' as string,
    bottleMaterialId: '' as string,
    stickerMaterialId: '' as string,
    distributorId: '' as string,
    packagingIds: [] as string[],
    deliveryIds: [] as string[],
  }

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const batches = db.collection('jaba_batches')
    const rawMaterials = db.collection('jaba_rawMaterials')
    const packaging = db.collection('jaba_packagingOutput')
    const deliveryNotes = db.collection('jaba_deliveryNotes')
    const distributors = db.collection('jaba_distributors')

    const testTag = `CONCURRENCY-${stamp}`
    const batchNumber = `TEST-BATCH-${stamp}`
    const bottleName = `TEST Bottles ${stamp}`
    const stickerName = `TEST Stickers ${stamp}`
    const distributorName = `TEST Distributor ${stamp}`

    console.log('Creating isolated test fixtures...')

    const [bottleInsert, stickerInsert, distributorInsert, batchInsert] = await Promise.all([
      rawMaterials.insertOne({
        name: bottleName,
        category: 'Packaging',
        currentStock: 100,
        unit: 'pcs',
        minStock: 10,
        supplier: 'TEST',
        reorderLevel: 20,
        preferredSupplier: 'TEST',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      rawMaterials.insertOne({
        name: stickerName,
        category: 'Packaging',
        currentStock: 100,
        unit: 'pcs',
        minStock: 10,
        supplier: 'TEST',
        reorderLevel: 20,
        preferredSupplier: 'TEST',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      distributors.insertOne({
        name: distributorName,
        contactPerson: 'Test Runner',
        phone: '0000000000',
        region: 'Test',
        address: 'Test',
        notes: testTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      batches.insertOne({
        batchNumber,
        date: new Date(),
        flavor: 'Test',
        totalLitres: 100,
        status: 'QC Passed - Ready for Packaging',
        outputSummary: { remainingLitres: 100, totalBottles: 0 },
        bottles250ml: 0,
        bottles500ml: 0,
        bottles1L: 0,
        bottles2L: 0,
        supervisor: 'Test',
        shift: 'Morning',
        ingredients: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ])

    createdIds.bottleMaterialId = bottleInsert.insertedId.toString()
    createdIds.stickerMaterialId = stickerInsert.insertedId.toString()
    createdIds.distributorId = distributorInsert.insertedId.toString()
    createdIds.batchId = batchInsert.insertedId.toString()

    async function createPackagingAttempt(units: number, litres: number, label: string): Promise<PackagingAttemptResult> {
      const session = client.startSession()
      try {
        let createdId = ''
        await session.withTransaction(async () => {
          const batch = await batches.findOne({ _id: new ObjectId(createdIds.batchId) }, { session })
          if (!batch) throw new Error('Batch missing')

          const remaining = Number(batch.outputSummary?.remainingLitres ?? batch.totalLitres) || 0
          if (litres > remaining + 1e-6) throw new Error('Insufficient remaining litres')

          const bottle = await rawMaterials.findOne({ _id: new ObjectId(createdIds.bottleMaterialId) }, { session })
          const sticker = await rawMaterials.findOne({ _id: new ObjectId(createdIds.stickerMaterialId) }, { session })
          if (!bottle || !sticker) throw new Error('Material missing')
          if ((Number(bottle.currentStock) || 0) < units) throw new Error('Insufficient bottle stock')
          if ((Number(sticker.currentStock) || 0) < units) throw new Error('Insufficient sticker stock')

          const pkgInsert = await packaging.insertOne(
            {
              batchId: createdIds.batchId,
              batchNumber,
              packageNumber: `TEST-PKG-${label}-${stamp}`,
              volumeAllocated: litres,
              packagedLitres: litres,
              packagingDate: new Date(),
              packagingLine: 'TEST-LINE',
              supervisor: 'Test',
              teamMembers: ['Load Test'],
              containers: [{ size: '1L', quantity: units }],
              safetyChecks: true,
              defects: 0,
              materialsUsed: [
                { materialId: createdIds.bottleMaterialId, type: 'bottles', quantity: units },
                { materialId: createdIds.stickerMaterialId, type: 'stickers', quantity: units },
              ],
              createdAt: new Date(),
            },
            { session }
          )
          createdId = pkgInsert.insertedId.toString()

          const bottleDeduct = await rawMaterials.updateOne(
            { _id: new ObjectId(createdIds.bottleMaterialId), currentStock: { $gte: units } },
            { $inc: { currentStock: -units }, $set: { updatedAt: new Date() } },
            { session }
          )
          const stickerDeduct = await rawMaterials.updateOne(
            { _id: new ObjectId(createdIds.stickerMaterialId), currentStock: { $gte: units } },
            { $inc: { currentStock: -units }, $set: { updatedAt: new Date() } },
            { session }
          )
          if (bottleDeduct.modifiedCount !== 1 || stickerDeduct.modifiedCount !== 1) {
            throw new Error('Concurrent stock change detected during packaging')
          }

          await batches.updateOne(
            { _id: new ObjectId(createdIds.batchId) },
            {
              $set: {
                'outputSummary.remainingLitres': Math.max(0, remaining - litres),
                status: Math.max(0, remaining - litres) <= 0 ? 'Ready for Distribution' : 'Partially Packaged',
                updatedAt: new Date(),
              },
              $inc: {
                'outputSummary.totalBottles': units,
                bottles1L: units,
              },
            },
            { session }
          )
        })
        createdIds.packagingIds.push(createdId)
        return { ok: true, id: createdId }
      } catch (error: any) {
        return { ok: false, reason: error.message || 'packaging failed' }
      } finally {
        await session.endSession()
      }
    }

    console.log('\nRunning packaging concurrency test (2 attempts, each needs 60L and 60 bottles/stickers)...')
    const packagingResults = await Promise.all([
      createPackagingAttempt(60, 60, 'A'),
      createPackagingAttempt(60, 60, 'B'),
    ])
    packagingResults.forEach((r, i) => {
      console.log(`Packaging attempt ${i + 1}: ${r.ok ? `SUCCESS (${r.id})` : `BLOCKED (${r.reason})`}`)
    })

    async function createDeliveryAttempt(qty: number, label: string): Promise<DeliveryAttemptResult> {
      const session = client.startSession()
      try {
        let createdId = ''
        await session.withTransaction(async () => {
          const packRows = await packaging.find({ batchId: createdIds.batchId }, { session }).toArray()
          let totalPackaged = 0
          packRows.forEach((p) => {
            if (!Array.isArray((p as any).containers)) return
            ;(p as any).containers.forEach((c: any) => {
              if (c.size === '1L') totalPackaged += Number(c.quantity) || 0
            })
          })

          const notes = await deliveryNotes.find({}, { session }).toArray()
          let alreadyDistributed = 0
          notes.forEach((n: any) => {
            if (!Array.isArray(n.items)) return
            n.items.forEach((it: any) => {
              if (it.batchNumber === batchNumber && it.size === '1L') alreadyDistributed += Number(it.quantity) || 0
            })
          })

          const available = Math.max(0, totalPackaged - alreadyDistributed)
          if (qty > available) throw new Error(`Insufficient available stock (available ${available})`)

          const noteInsert = await deliveryNotes.insertOne(
            {
              noteId: `TEST-DN-${label}-${stamp}`,
              distributorId: createdIds.distributorId,
              distributorName,
              items: [
                {
                  finishedGoodId: `${batchNumber}|1L`,
                  productName: 'Test Product',
                  flavor: 'Test',
                  productType: 'Juice',
                  size: '1L',
                  batchNumber,
                  packageNumber: `TEST-PKG-${stamp}`,
                  quantity: qty,
                  pricePerUnit: 10,
                  totalCost: qty * 10,
                },
              ],
              totalCost: qty * 10,
              status: 'Pending',
              paymentStatus: 'Unpaid',
              date: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            { session }
          )
          createdId = noteInsert.insertedId.toString()
        })
        createdIds.deliveryIds.push(createdId)
        return { ok: true, id: createdId }
      } catch (error: any) {
        return { ok: false, reason: error.message || 'delivery failed' }
      } finally {
        await session.endSession()
      }
    }

    console.log('\nRunning delivery concurrency test (2 attempts, each requests 40 units)...')
    const deliveryResults = await Promise.all([
      createDeliveryAttempt(40, 'A'),
      createDeliveryAttempt(40, 'B'),
    ])
    deliveryResults.forEach((r, i) => {
      console.log(`Delivery attempt ${i + 1}: ${r.ok ? `SUCCESS (${r.id})` : `BLOCKED (${r.reason})`}`)
    })

    console.log('\nValidating invariants...')
    const [batchAfter, bottleAfter, stickerAfter, packagingAfter, deliveryAfter] = await Promise.all([
      batches.findOne({ _id: new ObjectId(createdIds.batchId) }),
      rawMaterials.findOne({ _id: new ObjectId(createdIds.bottleMaterialId) }),
      rawMaterials.findOne({ _id: new ObjectId(createdIds.stickerMaterialId) }),
      packaging.find({ batchId: createdIds.batchId }).toArray(),
      deliveryNotes.find({ distributorId: createdIds.distributorId }).toArray(),
    ])

    const packagedUnits = packagingAfter.reduce((sum, p: any) => {
      if (!Array.isArray(p.containers)) return sum
      return (
        sum +
        p.containers.reduce((s: number, c: any) => (c.size === '1L' ? s + (Number(c.quantity) || 0) : s), 0)
      )
    }, 0)
    const distributedUnits = deliveryAfter.reduce((sum, n: any) => {
      if (!Array.isArray(n.items)) return sum
      return (
        sum +
        n.items.reduce((s: number, it: any) => (it.batchNumber === batchNumber && it.size === '1L' ? s + (Number(it.quantity) || 0) : s), 0)
      )
    }, 0)
    const bottleStock = Number(bottleAfter?.currentStock) || 0
    const stickerStock = Number(stickerAfter?.currentStock) || 0
    const remainingLitres = Number(batchAfter?.outputSummary?.remainingLitres) || 0

    const checks = [
      { name: 'No negative bottle stock', pass: bottleStock >= 0 },
      { name: 'No negative sticker stock', pass: stickerStock >= 0 },
      { name: 'Distributed <= Packaged', pass: distributedUnits <= packagedUnits },
      { name: 'Packaged <= Initial capacity (100)', pass: packagedUnits <= 100 },
      { name: 'Remaining litres not negative', pass: remainingLitres >= 0 },
      { name: 'Bottle deduction matches packaging', pass: 100 - bottleStock === packagedUnits },
      { name: 'Sticker deduction matches packaging', pass: 100 - stickerStock === packagedUnits },
    ]

    checks.forEach((c) => {
      console.log(`- ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}`)
    })

    const failed = checks.filter((c) => !c.pass)
    console.log('\nSummary:')
    console.log(`Packaged units: ${packagedUnits}`)
    console.log(`Distributed units: ${distributedUnits}`)
    console.log(`Bottle stock: ${bottleStock}`)
    console.log(`Sticker stock: ${stickerStock}`)
    console.log(`Batch remaining litres: ${remainingLitres}`)
    console.log(`Invariant status: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.length} failed)`}`)

    if (failed.length > 0) {
      process.exitCode = 1
    }
  } catch (error: any) {
    console.error('Concurrency test failed:', error.message || String(error))
    process.exitCode = 1
  } finally {
    if (!KEEP_DATA) {
      try {
        const db = client.db(DB_NAME)
        if (createdIds.deliveryIds.length > 0) {
          await db.collection('jaba_deliveryNotes').deleteMany({ _id: { $in: createdIds.deliveryIds.map((x) => new ObjectId(x)) } })
        }
        if (createdIds.packagingIds.length > 0) {
          await db.collection('jaba_packagingOutput').deleteMany({ _id: { $in: createdIds.packagingIds.map((x) => new ObjectId(x)) } })
        }
        if (createdIds.batchId) await db.collection('jaba_batches').deleteOne({ _id: new ObjectId(createdIds.batchId) })
        if (createdIds.bottleMaterialId) await db.collection('jaba_rawMaterials').deleteOne({ _id: new ObjectId(createdIds.bottleMaterialId) })
        if (createdIds.stickerMaterialId) await db.collection('jaba_rawMaterials').deleteOne({ _id: new ObjectId(createdIds.stickerMaterialId) })
        if (createdIds.distributorId) await db.collection('jaba_distributors').deleteOne({ _id: new ObjectId(createdIds.distributorId) })
      } catch (cleanupError: any) {
        console.error('Cleanup warning:', cleanupError.message || String(cleanupError))
      }
    } else {
      console.log('\n--keep enabled: test data preserved in database.')
    }

    await client.close()
  }
}

run()
