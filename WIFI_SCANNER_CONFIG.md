# WiFi Barcode Scanner Configuration Guide

## Quick Setup

### API Endpoint
Your WiFi scanner should POST barcode data to:
```
POST https://yourdomain.com/api/bar/barcode-scan
```

### Request Format
```json
{
  "barcode": "1234567890123",
  "scannerId": "wifi-scanner-1",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Barcode scan received",
  "barcode": "1234567890123"
}
```

## Testing the Endpoint

### Using cURL
```bash
curl -X POST https://yourdomain.com/api/bar/barcode-scan \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "1234567890",
    "scannerId": "test-scanner",
    "timestamp": "2024-01-01T12:00:00Z"
  }'
```

### Using JavaScript (Fetch)
```javascript
fetch('https://yourdomain.com/api/bar/barcode-scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    barcode: '1234567890',
    scannerId: 'test-scanner',
    timestamp: new Date().toISOString()
  })
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

### Using Postman
1. Method: POST
2. URL: `https://yourdomain.com/api/bar/barcode-scan`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "barcode": "1234567890",
  "scannerId": "test-scanner",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Scanner Configuration Examples

### Generic HTTP Scanner
Most WiFi scanners support HTTP POST configuration. Use these settings:

- **URL**: `https://yourdomain.com/api/bar/barcode-scan`
- **Method**: POST
- **Content-Type**: `application/json`
- **Body Template**: 
  ```json
  {"barcode":"{SCAN_DATA}","scannerId":"scanner-1","timestamp":"{TIMESTAMP}"}
  ```

### Zebra Scanner
If using Zebra scanners with DataWedge or Enterprise Browser:

1. Create HTTP profile
2. Set URL: `https://yourdomain.com/api/bar/barcode-scan`
3. Set Method: POST
4. Set Headers: `Content-Type: application/json`
5. Set Body: `{"barcode":"%s","scannerId":"zebra-1"}`

### Socket Mobile Scanner
If using Socket Mobile scanners:

1. Configure HTTP action
2. Set endpoint: `https://yourdomain.com/api/bar/barcode-scan`
3. Set payload format: JSON
4. Map barcode to `barcode` field

## Field Requirements

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `barcode` | ✅ Yes | String | The scanned barcode value |
| `scannerId` | ❌ No | String | Identifier for the scanner (defaults to "wifi-scanner") |
| `timestamp` | ❌ No | String (ISO 8601) | Timestamp of the scan (defaults to current time) |

## How It Works

1. **Scanner Sends Data**: WiFi scanner POSTs barcode to API endpoint
2. **API Stores Scan**: Scan is stored in database temporarily (30 second TTL)
3. **POS Polls for Scans**: POS page polls `/api/bar/barcode-scan?lastCheck=...` every 500ms
4. **Product Added**: When scan is received, product is found and added to cart
5. **Scan Marked Processed**: Scan is marked as processed to prevent duplicates

## Troubleshooting

### Scanner Sends Data But Nothing Happens
- Check that POS page is open and active
- Verify polling is working (check browser console)
- Ensure scanner is sending correct JSON format
- Check API endpoint is accessible from scanner's network

### Network Errors
- Ensure scanner can reach your domain (HTTPS)
- Check firewall rules allow outbound HTTPS
- Verify SSL certificate is valid
- Test endpoint with curl from scanner's network

### Format Errors
- Verify JSON is valid
- Check `barcode` field is present and is a string
- Ensure Content-Type header is `application/json`

## Security Notes

- **HTTPS Required**: All communication must use HTTPS
- **CORS**: API endpoint allows requests from your domain
- **Rate Limiting**: Consider implementing rate limiting for production
- **Authentication**: Consider adding API key authentication for production use

## Production Recommendations

1. **Add API Key Authentication**
   ```json
   {
     "barcode": "1234567890",
     "scannerId": "scanner-1",
     "apiKey": "your-secret-api-key"
   }
   ```

2. **Implement Rate Limiting**
   - Limit requests per scanner
   - Prevent abuse

3. **Add Logging**
   - Log all scan attempts
   - Monitor for errors

4. **Network Security**
   - Use VPN if scanner is on different network
   - Consider firewall rules
   - Use HTTPS with valid certificate

