# Complete Receipt Printer Integration Guide

## Overview

Your POS system now supports **three types of receipt printers**:
1. **USB Receipt Printers** - Connect via USB cable
2. **Bluetooth Receipt Printers** - Wireless Bluetooth connection
3. **WiFi Receipt Printers** - Network-connected printers

All three types work seamlessly with your hosted website! This guide explains how to set up and use each type.

---

## 1. USB Receipt Printer

### How It Works
- USB thermal printers connect directly via USB cable
- Two printing methods available:
  - **System Print**: Uses browser print dialog (works on all devices)
  - **Direct Print**: Uses Web Serial API for direct ESC/POS printing (Chrome/Edge only)

### Setup Instructions

#### Method 1: System Print (Recommended - Works Everywhere)

1. **Connect Your USB Printer**
   - Plug the USB printer into your device
   - For tablets: Use a USB OTG (On-The-Go) adapter
   - Install printer drivers if needed (Windows/Mac)

2. **Open Your POS System**
   - Complete a transaction to see the receipt modal
   - Click "System Print" button

3. **Print Receipt**
   - Browser print dialog will open
   - Select your USB printer
   - Click Print
   - Receipt will print automatically

**Advantages:**
- ✅ Works on any device and browser
- ✅ No special configuration needed
- ✅ Uses system printer settings

#### Method 2: Direct Print (Chrome/Edge Only)

1. **Connect Your USB Printer**
   - Plug the USB printer into your device
   - Ensure printer is in ESC/POS mode

2. **Open Your POS System**
   - Complete a transaction
   - Click "Direct Print" button

3. **Select Printer**
   - Browser will prompt to select serial port
   - Choose your USB printer
   - Receipt will print directly

**Advantages:**
- ✅ Direct ESC/POS printing (thermal printer optimized)
- ✅ No print dialog
- ✅ Faster printing

**Limitations:**
- ⚠️ Chrome/Edge only
- ⚠️ Requires user permission for serial port access

### Requirements
- ✅ USB port or USB OTG adapter (for tablets)
- ✅ Thermal receipt printer (80mm or 58mm)
- ✅ Works on any browser (system print)
- ✅ Chrome/Edge for direct print (Web Serial API)

### Device Compatibility
- ✅ **Windows/Mac/Linux computers**: Full support
- ✅ **Android tablets**: Full support (with USB OTG adapter)
- ✅ **iPad**: Limited (system print only, requires special adapters)
- ✅ **Chrome OS devices**: Full support

---

## 2. Bluetooth Receipt Printer

### How It Works
- Bluetooth thermal printers connect wirelessly
- Two printing methods available:
  - **System Print**: Uses browser print dialog (works on all devices)
  - **Direct Print**: Uses Web Serial API for direct ESC/POS printing (Chrome/Edge only)

### Setup Instructions

#### Method 1: System Print (Recommended - Works Everywhere)

1. **Pair Your Bluetooth Printer**
   - Put your printer in pairing mode (usually hold a button)
   - On your tablet/device, go to Bluetooth settings
   - Find and pair with your printer
   - Install printer drivers if needed

2. **Add Printer to System**
   - Add the Bluetooth printer as a system printer
   - Windows: Settings > Devices > Printers
   - Mac: System Preferences > Printers & Scanners
   - Android: Settings > Connected devices > Bluetooth

3. **Open Your POS System**
   - Complete a transaction
   - Click "System Print" button

4. **Print Receipt**
   - Browser print dialog will open
   - Select your Bluetooth printer
   - Click Print

#### Method 2: Direct Print (Chrome/Edge Only)

1. **Pair Your Bluetooth Printer**
   - Pair printer with your device via Bluetooth settings
   - Ensure printer is in ESC/POS mode

2. **Open Your POS System**
   - Complete a transaction
   - Click "Direct Print" button

3. **Select Printer**
   - Browser will prompt to select serial port
   - Choose your Bluetooth printer
   - Receipt will print directly

### Requirements
- ✅ Bluetooth-enabled device
- ✅ Thermal receipt printer with Bluetooth
- ✅ Works on any browser (system print)
- ✅ Chrome/Edge for direct print

### Device Compatibility
- ✅ **Windows/Mac/Linux computers**: Full support
- ✅ **Android tablets/phones**: Full support
- ✅ **iPad/iPhone**: System print only
- ✅ **Chrome OS devices**: Full support

---

## 3. WiFi Receipt Printer

### How It Works
- WiFi thermal printers connect to your network
- Receipt data is sent via HTTP POST to API endpoint
- Printer receives ESC/POS formatted data
- Works with any network-connected thermal printer

### Setup Instructions

#### Step 1: Connect Printer to Network

1. **Configure Printer Network**
   - Connect your WiFi printer to the same network as your devices
   - Note the printer's IP address (usually shown on printer display or via printer settings)
   - Common ports: 9100 (raw printing), 515 (LPR), 631 (IPP)

#### Step 2: Configure Printer IP (Optional)

If you want automatic printing, configure the printer IP in your system:

1. **Set Printer IP in Environment**
   - Add to your environment variables or settings:
     ```
     RECEIPT_PRINTER_IP=192.168.1.100
     RECEIPT_PRINTER_PORT=9100
     ```

2. **Or Pass IP When Printing**
   - The API accepts `printerIp` parameter
   - You can configure this in the POS settings

#### Step 3: Print Receipt

1. **Open Your POS System**
   - Complete a transaction
   - Click "WiFi Print" button

2. **Receipt Sent**
   - Receipt is formatted as ESC/POS
   - Sent to printer via network
   - Printer prints automatically

### API Endpoint Details

**POST Endpoint**: `/api/bar/print-receipt`

**Request Body**:
```json
{
  "items": [
    {
      "name": "Product Name",
      "quantity": 2,
      "price": 100.00,
      "total": 200.00
    }
  ],
  "transactionId": "TXN12345678",
  "table": 5,
  "cashier": "John Doe",
  "waiter": "Jane Smith",
  "paymentMethod": "cash",
  "subtotal": 200.00,
  "vat": 32.00,
  "total": 232.00,
  "printerIp": "192.168.1.100",
  "printerPort": 9100
}
```

**Response**:
```json
{
  "success": true,
  "message": "Receipt sent to printer",
  "printerIp": "192.168.1.100",
  "transactionId": "TXN12345678"
}
```

### Printer Configuration

#### Common WiFi Printer Ports
- **9100**: Raw printing (most common for thermal printers)
- **515**: LPR/LPD printing
- **631**: IPP (Internet Printing Protocol)

#### Test Printer Connection

You can test if your printer is accessible:

```bash
# Test connection
curl "https://yourdomain.com/api/bar/print-receipt?ip=192.168.1.100&port=9100"

# Response
{
  "success": true,
  "connected": true,
  "printerIp": "192.168.1.100",
  "printerPort": 9100
}
```

### Requirements
- ✅ WiFi printer with network connectivity
- ✅ Printer and devices on same network (or accessible network)
- ✅ HTTPS for production (required for security)
- ✅ Printer IP address and port

### Supported Printer Types
- ✅ **ESC/POS thermal printers** (most common)
- ✅ **Network-enabled receipt printers**
- ✅ **Any printer supporting raw TCP/IP printing**

---

## Universal Features (All Printer Types)

### Receipt Format
- Professional receipt layout
- Company header and branding
- Transaction details (ID, date, time, table)
- Itemized list with quantities and prices
- Subtotal, VAT, and total calculations
- Payment method display
- Footer message

### Print Options
- **System Print**: Works on all devices via browser print dialog
- **Direct Print**: Direct ESC/POS printing (Chrome/Edge only)
- **WiFi Print**: Network printing for WiFi printers

### Error Handling
- Clear error messages if printing fails
- Fallback options available
- Toast notifications for success/failure

---

## Requirements Summary

### For Development (localhost)
- ✅ Works on `http://localhost:3000` (no HTTPS needed)
- ✅ Works on any browser
- ✅ USB/Bluetooth: Full support
- ✅ WiFi: Requires network configuration

### For Production (Hosted Website)
- ✅ **HTTPS is required** for security
- ✅ Works on any modern browser
- ✅ USB/Bluetooth: Full support (system print works everywhere)
- ✅ WiFi: Requires network connectivity and HTTPS

---

## Browser Compatibility

### System Print (USB/Bluetooth)
- ✅ **All browsers**: Full support
- ✅ **All devices**: Works as long as printer is added to system

### Direct Print (USB/Bluetooth - Web Serial)
- ✅ **Chrome/Edge**: Full support (Windows, Mac, Linux, Android, Chrome OS)
- ⚠️ **Safari**: Not supported
- ⚠️ **Firefox**: Not supported

### WiFi Print
- ✅ **All browsers**: Full support (uses standard HTTP)
- ✅ **Any device**: Works as long as browser can access the website

---

## Comparison Table

| Feature | USB Printer | Bluetooth Printer | WiFi Printer |
|---------|-------------|-------------------|--------------|
| **Connection** | USB cable | Bluetooth wireless | WiFi network |
| **Range** | Cable length | ~10 meters | Network range |
| **Setup Complexity** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Advanced |
| **Device Requirements** | USB port/OTG | Bluetooth | Network access |
| **Works on Hosted Site** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multi-Device Support** | ❌ One device | ❌ One device | ✅ Multiple devices |
| **Direct ESC/POS** | ✅ Yes (Chrome) | ✅ Yes (Chrome) | ✅ Yes |
| **System Print** | ✅ Yes | ✅ Yes | ❌ No |
| **Best For** | Fixed stations | Mobile use | Multiple stations |

---

## Receipt Format Details

### ESC/POS Commands
The system uses standard ESC/POS commands for thermal printers:
- **Initialization**: Printer reset and setup
- **Text Formatting**: Bold, font sizes, alignment
- **Line Feeds**: Proper spacing
- **Paper Cut**: Automatic cutting after print

### Receipt Content
- Company name and address
- Receipt number and transaction details
- Table number (if applicable)
- Cashier and waiter information
- Itemized product list
- Subtotal, VAT (16%), and total
- Payment method
- Thank you message

### Paper Sizes
- **80mm**: Standard receipt width (recommended)
- **58mm**: Narrow receipt width (also supported)

---

## Troubleshooting

### USB Printer Not Working?

1. **Check USB Connection**
   - Ensure printer is properly connected
   - Try a different USB port
   - For tablets, verify USB OTG adapter is working

2. **Check Printer Drivers**
   - Install printer drivers if needed
   - Verify printer appears in system printers list

3. **Try Different Print Method**
   - If direct print fails, try system print
   - If system print fails, check printer settings

### Bluetooth Printer Not Working?

1. **Check Bluetooth Connection**
   - Ensure printer is paired with your device
   - Check if printer is in range
   - Try disconnecting and reconnecting

2. **Check System Printer Setup**
   - Verify printer is added as system printer
   - Check printer is set as default (optional)

3. **Try Different Print Method**
   - If direct print fails, try system print
   - Ensure printer supports ESC/POS

### WiFi Printer Not Working?

1. **Check Network Connection**
   - Verify printer is connected to network
   - Test network connectivity from printer
   - Check firewall rules

2. **Check Printer IP and Port**
   - Verify printer IP address is correct
   - Test connection: `curl "https://yourdomain.com/api/bar/print-receipt?ip=PRINTER_IP&port=9100"`
   - Common ports: 9100 (raw), 515 (LPR), 631 (IPP)

3. **Check API Configuration**
   - Verify API endpoint is accessible
   - Check browser console for errors
   - Ensure HTTPS is working

4. **Test Printer Directly**
   ```bash
   # Test raw connection to printer
   telnet PRINTER_IP 9100
   # Or use netcat
   nc PRINTER_IP 9100
   ```

### Print Quality Issues?

1. **Check Printer Settings**
   - Verify paper size matches (80mm or 58mm)
   - Check printer density/contrast settings
   - Ensure printer is in ESC/POS mode

2. **Check Receipt Format**
   - Receipt is formatted for 80mm width
   - Text may be cut off on 58mm printers
   - Adjust printer settings if needed

---

## Best Practices

1. **Choose the Right Method**
   - **System Print**: Best for compatibility, works everywhere
   - **Direct Print**: Best for speed and ESC/POS optimization (Chrome/Edge)
   - **WiFi Print**: Best for multiple devices and network printing

2. **Printer Configuration**
   - Set printer to auto-cut paper after print
   - Configure paper size (80mm recommended)
   - Set appropriate print density

3. **Network Setup (WiFi)**
   - Use static IP for printer (recommended)
   - Ensure printer and devices on same network
   - Test connection before going live

4. **Error Handling**
   - Always have a backup print method
   - Monitor print success/failure
   - Provide manual print option if automatic fails

5. **Testing**
   - Test with sample receipts before production
   - Verify receipt format looks correct
   - Test all print methods available

---

## Testing

### Test System Print
1. Complete a transaction
2. Click "System Print"
3. Verify print dialog opens
4. Select printer and print
5. Verify receipt prints correctly

### Test Direct Print (Chrome/Edge)
1. Complete a transaction
2. Click "Direct Print"
3. Select printer from serial port list
4. Verify receipt prints directly

### Test WiFi Print
1. Configure printer IP
2. Complete a transaction
3. Click "WiFi Print"
4. Verify receipt is sent to printer
5. Check printer receives and prints

### Test API Endpoint
```bash
curl -X POST https://yourdomain.com/api/bar/print-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "Test", "quantity": 1, "price": 10.00, "total": 10.00}],
    "transactionId": "TEST123",
    "paymentMethod": "cash",
    "subtotal": 10.00,
    "vat": 1.60,
    "total": 11.60,
    "printerIp": "192.168.1.100"
  }'
```

---

## Security Notes

- **HTTPS Required**: For production, HTTPS is required for security
- **Network Security**: Ensure WiFi printer network is secure
- **API Access**: Consider adding API key authentication for production
- **Printer Access**: Limit printer network access if possible

---

## Quick Start Checklist

### USB Printer
- [ ] Connect printer via USB
- [ ] Install printer drivers (if needed)
- [ ] Complete transaction
- [ ] Click "System Print" or "Direct Print"
- [ ] Verify receipt prints

### Bluetooth Printer
- [ ] Pair printer with device
- [ ] Add printer to system printers
- [ ] Complete transaction
- [ ] Click "System Print" or "Direct Print"
- [ ] Verify receipt prints

### WiFi Printer
- [ ] Connect printer to network
- [ ] Note printer IP address
- [ ] Test printer connection
- [ ] Complete transaction
- [ ] Click "WiFi Print"
- [ ] Verify receipt prints

---

## Support

If you encounter issues:
1. Check this guide first
2. Verify printer is properly connected/configured
3. Test with a simple print job
4. Check browser console for errors
5. Try alternative print method

---

**Note**: This implementation supports all three printer types and works seamlessly on hosted websites with HTTPS. System print works on all devices and browsers, while direct print (Web Serial) provides optimized ESC/POS printing for Chrome/Edge users. WiFi printing enables network-based printing for multiple devices.

