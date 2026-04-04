# How to Get Standard MongoDB Connection String

## The Problem
Your current connection uses `mongodb+srv://` which requires DNS SRV records. If DNS resolution fails, you get `querySrv ETIMEOUT` errors.

## The Solution: Get Standard Connection String

### Steps:

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com/

2. **Select Your Cluster**: Click on `Cluster0` (or your cluster name)

3. **Click "Connect"** button

4. **Choose "Connect your application"**

5. **Select**:
   - Driver: **Node.js**
   - Version: **5.5 or later**

6. **Look for Connection String Options**:
   - You should see your connection string
   - Look for a **"Standard Connection String"** option or toggle
   - If you see "SRV Connection String" toggle, switch it OFF to get Standard

7. **Copy the Standard Connection String**:
   - It will start with `mongodb://` (NOT `mongodb+srv://`)
   - It will have multiple hostnames like: `cluster0-shard-00-00.vzva8lc.mongodb.net:27017,cluster0-shard-00-01...`

8. **Update your .env file**:
   ```env
   MONGODB_URI=mongodb://infusionjaba_db1:infusionjaba_db1@cluster0-shard-00-00.vzva8lc.mongodb.net:27017,cluster0-shard-00-01.vzva8lc.mongodb.net:27017,cluster0-shard-00-02.vzva8lc.mongodb.net:27017/infusion_jaba?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
   ```

9. **Restart your dev server**

## Alternative: Fix Network Access

If you want to keep SRV connection:

1. MongoDB Atlas → **Network Access**
2. Click **"Add IP Address"**
3. Add `0.0.0.0/0` (for development) or your specific IP
4. Wait 2-5 minutes for changes to propagate

## Test After Update

```bash
npm run test-db
```

