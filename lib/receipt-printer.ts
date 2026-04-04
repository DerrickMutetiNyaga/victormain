/**
 * Receipt Printer Utilities
 * Supports USB, Bluetooth, and WiFi thermal printers
 */

export interface ReceiptData {
  transactionId: string
  date: string
  time: string
  table?: number
  cashier?: string
  waiter?: string
  items: Array<{
    name: string
    quantity: number
    price: number
    total: number
  }>
  subtotal: number
  vat: number
  total: number
  paymentMethod: string
}

/**
 * ESC/POS Commands for thermal printers
 */
export const ESC_POS = {
  // Initialize printer
  INIT: '\x1B\x40',
  // Text formatting
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
  // Font size
  FONT_NORMAL: '\x1D\x21\x00',
  FONT_LARGE: '\x1D\x21\x11',
  FONT_XLARGE: '\x1D\x21\x22',
  // Line feed
  LINE_FEED: '\x0A',
  // Cut paper
  CUT: '\x1D\x56\x42\x00',
  // Open cash drawer
  OPEN_DRAWER: '\x10\x14\x01\x00\x01',
}

/**
 * Format receipt as ESC/POS commands for thermal printers
 */
export function formatReceiptAsESCPOS(data: ReceiptData): Uint8Array {
  let receipt = ''
  
  // Initialize printer
  receipt += ESC_POS.INIT
  
  // Header - Center aligned, large font
  receipt += ESC_POS.ALIGN_CENTER
  receipt += ESC_POS.FONT_LARGE
  receipt += ESC_POS.BOLD_ON
  receipt += 'Catha Lounge\n'
  receipt += ESC_POS.BOLD_OFF
  receipt += ESC_POS.FONT_NORMAL
  receipt += 'Premium Bar & Lounge\n'
  receipt += '123 Nightlife Ave, Downtown\n'
  receipt += ESC_POS.LINE_FEED
  
  // Divider
  receipt += '--------------------------------\n'
  receipt += ESC_POS.LINE_FEED
  
  // Transaction info - Left aligned
  receipt += ESC_POS.ALIGN_LEFT
  receipt += `Receipt #: ${data.transactionId}\n`
  receipt += `Date: ${data.date}\n`
  receipt += `Time: ${data.time}\n`
  
  if (data.table) {
    receipt += `Table: ${data.table}\n`
  }
  if (data.cashier) {
    receipt += `Cashier: ${data.cashier}\n`
  }
  if (data.waiter) {
    receipt += `Served by: ${data.waiter}\n`
  }
  
  receipt += ESC_POS.LINE_FEED
  receipt += '--------------------------------\n'
  receipt += ESC_POS.LINE_FEED
  
  // Items
  receipt += ESC_POS.BOLD_ON
  receipt += 'ITEMS\n'
  receipt += ESC_POS.BOLD_OFF
  receipt += ESC_POS.LINE_FEED
  
  data.items.forEach((item) => {
    const name = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name
    const qty = `${item.quantity}x`
    const price = `Ksh ${item.total.toFixed(2)}`
    
    // Item name and quantity
    receipt += `${qty} ${name}\n`
    // Price aligned right
    receipt += ESC_POS.ALIGN_RIGHT
    receipt += `${price}\n`
    receipt += ESC_POS.ALIGN_LEFT
    receipt += ESC_POS.LINE_FEED
  })
  
  receipt += '--------------------------------\n'
  receipt += ESC_POS.LINE_FEED
  
  // Totals
  receipt += ESC_POS.ALIGN_RIGHT
  receipt += `Subtotal: Ksh ${data.subtotal.toFixed(2)}\n`
  receipt += ESC_POS.BOLD_ON
  receipt += ESC_POS.FONT_LARGE
  receipt += `TOTAL: Ksh ${data.total.toFixed(2)}\n`
  receipt += ESC_POS.FONT_NORMAL
  receipt += ESC_POS.BOLD_OFF
  receipt += ESC_POS.ALIGN_LEFT
  receipt += ESC_POS.LINE_FEED
  
  receipt += '--------------------------------\n'
  receipt += ESC_POS.LINE_FEED
  
  // Payment method
  receipt += ESC_POS.ALIGN_CENTER
  receipt += `Paid by: ${data.paymentMethod.toUpperCase()}\n`
  receipt += ESC_POS.LINE_FEED
  receipt += ESC_POS.LINE_FEED
  
  // Footer
  receipt += 'Thank you for visiting Catha Lounge!\n'
  receipt += 'Please drink responsibly\n'
  receipt += ESC_POS.LINE_FEED
  receipt += ESC_POS.LINE_FEED
  receipt += ESC_POS.LINE_FEED
  
  // Cut paper
  receipt += ESC_POS.CUT
  
  // Convert to Uint8Array
  const encoder = new TextEncoder()
  return encoder.encode(receipt)
}

/**
 * Format receipt as plain text (for browser print)
 */
export function formatReceiptAsText(data: ReceiptData): string {
  let receipt = ''
  
  receipt += '================================\n'
  receipt += '         Catha Lounge\n'
  receipt += '    Premium Bar & Lounge\n'
  receipt += '   123 Nightlife Ave, Downtown\n'
  receipt += '================================\n\n'
  
  receipt += `Receipt #: ${data.transactionId}\n`
  receipt += `Date: ${data.date}\n`
  receipt += `Time: ${data.time}\n`
  
  if (data.table) {
    receipt += `Table: ${data.table}\n`
  }
  if (data.cashier) {
    receipt += `Cashier: ${data.cashier}\n`
  }
  if (data.waiter) {
    receipt += `Served by: ${data.waiter}\n`
  }
  
  receipt += '\n--------------------------------\n'
  receipt += 'ITEMS\n'
  receipt += '--------------------------------\n\n'
  
  data.items.forEach((item) => {
    receipt += `${item.quantity}x ${item.name}\n`
    receipt += `    Ksh ${item.total.toFixed(2)}\n\n`
  })
  
  receipt += '--------------------------------\n'
  receipt += `Subtotal:        Ksh ${data.subtotal.toFixed(2)}\n`
  receipt += '--------------------------------\n'
  receipt += `TOTAL:           Ksh ${data.total.toFixed(2)}\n`
  receipt += '--------------------------------\n\n'
  
  receipt += `Payment Method: ${data.paymentMethod.toUpperCase()}\n\n`
  receipt += 'Thank you for visiting Catha Lounge!\n'
  receipt += 'Please drink responsibly\n\n'
  
  return receipt
}

/**
 * Print receipt using browser print API (USB/Bluetooth via system print)
 */
export function printReceiptBrowser(data: ReceiptData): void {
  const receiptText = formatReceiptAsText(data)
  
  // Create a print window
  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (!printWindow) {
    alert('Please allow popups to print receipts')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${data.transactionId}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 10mm;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
            }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre-wrap;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <pre>${receiptText}</pre>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `)
  
  printWindow.document.close()
}

/**
 * Detect if a port name suggests it's a printer
 */
function isLikelyPrinter(portName: string): boolean {
  const name = portName.toLowerCase()
  const printerKeywords = [
    'printer',
    'receipt',
    'thermal',
    'pos',
    'epson',
    'star',
    'bixolon',
    'citizen',
    'zebra',
    'hp',
    'canon',
    'brother',
    'esc/pos',
    'escpos',
    'serial',
    'usb',
    'com', // Windows COM ports
    'tty', // Linux/Mac TTY ports
  ]
  return printerKeywords.some(keyword => name.includes(keyword))
}

// Type for serial port filter
interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

/**
 * Get saved printer port filter (from previous selection)
 */
export function getSavedPrinterFilter(): SerialPortFilter | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem('pos-printer-filter')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error loading saved printer filter:', error)
  }
  return null
}

/**
 * Save printer port filter for future use
 */
export function savePrinterFilter(filter: SerialPortFilter): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('pos-printer-filter', JSON.stringify(filter))
  } catch (error) {
    console.error('Error saving printer filter:', error)
  }
}

/**
 * Print receipt using Web Serial API (USB/Bluetooth direct)
 * Automatically detects and uses paired/connected printers
 */
export async function printReceiptSerial(
  data: ReceiptData,
  options?: { autoSelect?: boolean; filter?: SerialPortFilter | { usbVendorId?: number; usbProductId?: number } }
): Promise<boolean> {
  try {
    // Check if Web Serial API is supported
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported. Use browser print instead.')
    }
    
    const serial = (navigator as any).serial
    let port: any = null
    
    // Try to use saved printer filter first (for auto-print)
    const savedFilter = getSavedPrinterFilter()
    const useFilter = options?.filter || savedFilter || undefined
    
    if (useFilter && options?.autoSelect !== false) {
      try {
        // Try to request port with saved filter (auto-selects if only one matches)
        port = await serial.requestPort({ filters: [useFilter] })
      } catch (error) {
        // If filter doesn't work, fall back to manual selection
        console.log('Saved filter not found, requesting manual selection')
        port = await serial.requestPort()
      }
    } else {
      // Request port access - browser will show available ports
      // User can select USB or Bluetooth printer
      port = await serial.requestPort()
    }
    
    // Save the selected port's filter for future auto-selection
    if (port && port.getInfo) {
      const portInfo = port.getInfo()
      if (portInfo.usbVendorId || portInfo.usbProductId) {
        const filter: SerialPortFilter = {
          usbVendorId: portInfo.usbVendorId,
          usbProductId: portInfo.usbProductId,
        }
        savePrinterFilter(filter)
      }
    }
    
    // Open port with baud rate 9600 (common for thermal printers)
    // Try common baud rates if 9600 doesn't work
    const baudRates = [9600, 115200, 19200, 38400]
    let opened = false
    
    for (const baudRate of baudRates) {
      try {
        await port.open({ baudRate })
        opened = true
        break
      } catch (error) {
        // Try next baud rate
        continue
      }
    }
    
    if (!opened) {
      throw new Error('Failed to open printer port. Check connection.')
    }
    
    // Format receipt as ESC/POS
    const receiptData = formatReceiptAsESCPOS(data)
    
    // Get writable stream
    const writer = port.writable.getWriter()
    
    // Write receipt data
    await writer.write(receiptData)
    
    // Wait a bit for data to be sent
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Release writer and close port
    writer.releaseLock()
    await port.close()
    
    return true
  } catch (error: any) {
    console.error('Serial print error:', error)
    
    // If user cancelled port selection, don't show error
    if (error.name === 'NotFoundError' || error.message?.includes('cancel')) {
      throw new Error('Printer selection cancelled')
    }
    
    throw error
  }
}

/**
 * Prepare receipt data for API
 */
export function prepareReceiptData(
  items: Array<{ name: string; quantity: number; price: number }>,
  transactionId: string,
  table: number | null,
  cashier: string | undefined,
  waiter: string | undefined,
  paymentMethod: string,
  subtotal: number,
  vat: number,
  total: number
): ReceiptData {
  const now = new Date()
  
  return {
    transactionId,
    date: now.toLocaleDateString('en-KE'),
    time: now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    table: table || undefined,
    cashier,
    waiter,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    })),
    subtotal,
    vat,
    total,
    paymentMethod,
  }
}

