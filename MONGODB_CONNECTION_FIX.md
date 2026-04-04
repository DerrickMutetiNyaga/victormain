# Fix MongoDB Connection DNS Timeout

## Problem
The error `querySrv ETIMEOUT` occurs because your connection string uses `mongodb+srv://` which requires DNS SRV record resolution. This can fail due to network/DNS issues.

## Solution: Use Standard Connection String

### Step 1: Get Standard Connection String from MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Select **Driver**: Node.js, **Version**: 5.5 or later
5. **IMPORTANT**: Look for a toggle or option that says **"Standard Connection String"** or **"Non-SRV"**
6. Copy the connection string (it will look like `mongodb://` instead of `mongodb+srv://`)

### Step 2: Update Your .env File

Replace your current `MONGODB_URI` with the Standard Connection String:

```env
MONGODB_URI=mongodb://infusionjaba_db1:infusionjaba_db1@cluster0-shard-00-00.vzva8lc.mongodb.net:27017,cluster0-shard-00-01.vzva8lc.mongodb.net:27017,cluster0-shard-00-02.vzva8lc.mongodb.net:27017/infusion_jaba?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

**Note**: The actual connection string will be different - copy it from MongoDB Atlas.

### Step 3: Restart Your Dev Server

```bash
# Stop your server (Ctrl+C) and restart:
npm run dev
```

## Alternative: Check Network Access

If you want to keep using SRV connection:

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Add `0.0.0.0/0` (allow from anywhere) for development
4. Or add your current IP address
5. Wait a few minutes for changes to propagate

## Test Connection

After updating, test the connection:

```bash
npm run test-db
```

This will verify your MongoDB connection is working.

