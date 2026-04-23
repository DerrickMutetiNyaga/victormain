import { describe, expect, it } from 'vitest'
import { deriveFifoDeliveryNotePayload } from '@/lib/jaba-delivery-note-fifo-allocation'

describe('deriveFifoDeliveryNotePayload FIFO allocation', () => {
  it('allocates oldest batches first and supports partial take on last batch', () => {
    const batches = [
      {
        _id: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-12T10:00:00.000Z',
      },
    ]

    // Intentionally unsorted input to prove FIFO re-ordering is server-side.
    const packagingOutputs = [
      {
        _id: '000000000000000000000102',
        batchId: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        packageNumber: 'PKG-2026-40460',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 20 }],
        createdAt: '2026-03-12T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000100',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-10557',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 5 }],
        createdAt: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000101',
        batchId: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        packageNumber: 'PKG-2026-91331',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 10 }],
        createdAt: '2026-03-11T10:00:00.000Z',
      },
    ]

    const result = deriveFifoDeliveryNotePayload({
      staffLines: [
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '500ml',
          quantity: 25,
          pricePerUnit: 120,
        },
      ],
      packagingOutputs,
      batches,
      deliveryNotes: [],
      excludeNoteId: null,
    })

    expect(result.items).toHaveLength(3)
    expect(result.items.map((i) => [i.batchNumber, i.quantity])).toEqual([
      ['BCH-2026-01310', 5],
      ['BCH-2026-01311', 10],
      ['BCH-2026-01312', 10],
    ])
    expect(result.allocationTrace[0]?.slices.map((s) => [s.batchNumber, s.quantity])).toEqual([
      ['BCH-2026-01310', 5],
      ['BCH-2026-01311', 10],
      ['BCH-2026-01312', 10],
    ])
  })

  it('calculates money in cents internally and returns stable rounded KES totals', () => {
    const batches = [
      {
        _id: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-12T10:00:00.000Z',
      },
    ]

    const packagingOutputs = [
      {
        _id: '000000000000000000000100',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-10557',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 5 }],
        createdAt: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000101',
        batchId: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        packageNumber: 'PKG-2026-91331',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 10 }],
        createdAt: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000102',
        batchId: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        packageNumber: 'PKG-2026-40460',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 20 }],
        createdAt: '2026-03-12T10:00:00.000Z',
      },
    ]

    const result = deriveFifoDeliveryNotePayload({
      staffLines: [
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '500ml',
          quantity: 25,
          pricePerUnit: 12.345, // rounds to 12.35 (1235 cents)
        },
      ],
      packagingOutputs,
      batches,
      deliveryNotes: [],
      excludeNoteId: null,
    })

    // 25 * 12.35 = 308.75 exactly in cents (30875)
    expect(result.totalCost).toBe(308.75)
    expect(result.items.map((i) => i.totalCost)).toEqual([61.75, 123.5, 123.5])
    expect(result.items.every((i) => Number.isInteger(Math.round(i.totalCost * 100)))).toBe(true)
  })

  it('does not mix allocations between same flavor with different bottle sizes', () => {
    const batches = [
      {
        _id: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-11T10:00:00.000Z',
      },
    ]

    // Same flavour, two sizes, and unsorted packaging docs.
    const packagingOutputs = [
      {
        _id: '000000000000000000000111',
        batchId: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        packageNumber: 'PKG-2026-22222',
        flavourName: 'Jaba of Dawa',
        containers: [
          { size: '250ml', quantity: 20 },
          { size: '500ml', quantity: 8 },
        ],
        createdAt: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000110',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-11111',
        flavourName: 'Jaba of Dawa',
        containers: [
          { size: '250ml', quantity: 10 },
          { size: '500ml', quantity: 5 },
        ],
        createdAt: '2026-03-10T10:00:00.000Z',
      },
    ]

    const result = deriveFifoDeliveryNotePayload({
      staffLines: [
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '500ml',
          quantity: 12,
          pricePerUnit: 100,
        },
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '250ml',
          quantity: 24,
          pricePerUnit: 70,
        },
      ],
      packagingOutputs,
      batches,
      deliveryNotes: [],
      excludeNoteId: null,
    })

    const items500 = result.items.filter((i) => i.size === '500ml')
    const items250 = result.items.filter((i) => i.size === '250ml')

    // 500ml should use only 500ml slots, oldest first: 5 then 7.
    expect(items500.map((i) => [i.batchNumber, i.quantity])).toEqual([
      ['BCH-2026-01310', 5],
      ['BCH-2026-01311', 7],
    ])

    // 250ml should use only 250ml slots, oldest first: 10 then 14.
    expect(items250.map((i) => [i.batchNumber, i.quantity])).toEqual([
      ['BCH-2026-01310', 10],
      ['BCH-2026-01311', 14],
    ])
  })

  it('does not mix allocations across different flavors even for same bottle size', () => {
    const batches = [
      {
        _id: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        flavor: 'Jaba of Dawa',
        productCategory: 'Infusion Jaba',
        date: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        flavor: 'Jaba of Pineapple',
        productCategory: 'Infusion Jaba',
        date: '2026-03-11T10:00:00.000Z',
      },
    ]

    const packagingOutputs = [
      {
        _id: '000000000000000000000120',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-DAWA',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 6 }],
        createdAt: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000121',
        batchId: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        packageNumber: 'PKG-2026-PINE',
        flavourName: 'Jaba of Pineapple',
        containers: [{ size: '500ml', quantity: 9 }],
        createdAt: '2026-03-11T10:00:00.000Z',
      },
    ]

    const result = deriveFifoDeliveryNotePayload({
      staffLines: [
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '500ml',
          quantity: 6,
          pricePerUnit: 90,
        },
        {
          flavor: 'Jaba of Pineapple',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Pineapple',
          size: '500ml',
          quantity: 9,
          pricePerUnit: 95,
        },
      ],
      packagingOutputs,
      batches,
      deliveryNotes: [],
      excludeNoteId: null,
    })

    expect(
      result.items
        .filter((i) => i.flavor === 'Jaba of Dawa')
        .map((i) => [i.batchNumber, i.quantity])
    ).toEqual([['BCH-2026-01310', 6]])

    expect(
      result.items
        .filter((i) => i.flavor === 'Jaba of Pineapple')
        .map((i) => [i.batchNumber, i.quantity])
    ).toEqual([['BCH-2026-01311', 9]])
  })

  it('matches the pictured multi-flavor multi-size FIFO allocation snapshot', () => {
    const batches = [
      {
        _id: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        flavor: 'Mixed',
        productCategory: 'Infusion Jaba',
        date: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        flavor: 'Mixed',
        productCategory: 'Infusion Jaba',
        date: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        flavor: 'Mixed',
        productCategory: 'Infusion Jaba',
        date: '2026-03-12T10:00:00.000Z',
      },
    ]

    const packagingOutputs = [
      {
        _id: '000000000000000000000201',
        batchId: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        packageNumber: 'PKG-2026-40460',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '250ml', quantity: 24 }],
        createdAt: '2026-03-12T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000202',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-10557',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 10 }],
        createdAt: '2026-03-10T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000203',
        batchId: '00000000000000000000000b',
        batchNumber: 'BCH-2026-01311',
        packageNumber: 'PKG-2026-91331',
        flavourName: 'Jaba of Dawa',
        containers: [{ size: '500ml', quantity: 26 }],
        createdAt: '2026-03-11T10:00:00.000Z',
      },
      {
        _id: '000000000000000000000204',
        batchId: '00000000000000000000000c',
        batchNumber: 'BCH-2026-01312',
        packageNumber: 'PKG-2026-40460',
        flavourName: 'Jaba of Pineapple',
        containers: [{ size: '250ml', quantity: 12 }],
        createdAt: '2026-03-12T11:00:00.000Z',
      },
      {
        _id: '000000000000000000000205',
        batchId: '00000000000000000000000a',
        batchNumber: 'BCH-2026-01310',
        packageNumber: 'PKG-2026-10557',
        flavourName: 'Jaba of Pineapple',
        containers: [{ size: '500ml', quantity: 36 }],
        createdAt: '2026-03-10T11:00:00.000Z',
      },
    ]

    const result = deriveFifoDeliveryNotePayload({
      staffLines: [
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '250ml',
          quantity: 24,
          pricePerUnit: 100,
        },
        {
          flavor: 'Jaba of Dawa',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Dawa',
          size: '500ml',
          quantity: 36,
          pricePerUnit: 100,
        },
        {
          flavor: 'Jaba of Pineapple',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Pineapple',
          size: '250ml',
          quantity: 12,
          pricePerUnit: 100,
        },
        {
          flavor: 'Jaba of Pineapple',
          productType: 'Infusion Jaba',
          productName: 'Infusion Jaba of Pineapple',
          size: '500ml',
          quantity: 36,
          pricePerUnit: 100,
        },
      ],
      packagingOutputs,
      batches,
      deliveryNotes: [],
      excludeNoteId: null,
    })

    expect(
      result.items.map((i) => ({
        size: i.size,
        flavor: i.flavor,
        batchNumber: i.batchNumber,
        packageNumber: i.packageNumber,
        quantity: i.quantity,
      }))
    ).toEqual([
      { size: '250ml', flavor: 'Jaba of Dawa', batchNumber: 'BCH-2026-01312', packageNumber: 'PKG-2026-40460', quantity: 24 },
      { size: '500ml', flavor: 'Jaba of Dawa', batchNumber: 'BCH-2026-01310', packageNumber: 'PKG-2026-10557', quantity: 10 },
      { size: '500ml', flavor: 'Jaba of Dawa', batchNumber: 'BCH-2026-01311', packageNumber: 'PKG-2026-91331', quantity: 26 },
      { size: '250ml', flavor: 'Jaba of Pineapple', batchNumber: 'BCH-2026-01312', packageNumber: 'PKG-2026-40460', quantity: 12 },
      { size: '500ml', flavor: 'Jaba of Pineapple', batchNumber: 'BCH-2026-01310', packageNumber: 'PKG-2026-10557', quantity: 36 },
    ])
  })
})
