# Vercel Environment Variables Setup Guide

## Your Vercel Domain
**Production URL:** `https://infusion-ashy.vercel.app/`

## Required Changes

### 1. Update Environment Variables in Vercel Dashboard

Go to your Vercel project → **Settings** → **Environment Variables** and update/add these:

#### ✅ MUST CHANGE:

**1. NEXTAUTH_URL**
```
Current: http://localhost:3000
Change to: https://infusion-ashy.vercel.app
```

**2. NEXTAUTH_SECRET**
```
Current: your-secret-key-change-this-in-production
Change to: [Generate a secure random string - see below]
```

#### ✅ KEEP AS IS (No changes needed):

**3. MONGODB_URI**
```
Set to: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
(Get from MongoDB Atlas → Connect → Drivers)
```

**4. CLOUDINARY_CLOUD_NAME**
```
Set to: your-cloudinary-cloud-name
(Get from Cloudinary Console → Dashboard)
```

**5. CLOUDINARY_API_KEY**
```
Set to: your-cloudinary-api-key
(Get from Cloudinary Console → API Keys)
```

**6. CLOUDINARY_API_SECRET**
```
Set to: your-cloudinary-api-secret
(Get from Cloudinary Console → API Keys)
```

**7. GOOGLE_CLIENT_ID**
```
Set to: your-google-client-id.apps.googleusercontent.com
(Get from Google Cloud Console → APIs & Services → Credentials)
```

**8. GOOGLE_CLIENT_SECRET**
```
Set to: your-google-client-secret
(Get from Google Cloud Console → APIs & Services → Credentials)
```

---

## Step-by-Step Instructions

### Step 1: Generate NEXTAUTH_SECRET

**Option A: Using OpenSSL (if you have it installed)**
```bash
openssl rand -base64 32
```

**Option B: Online Generator**
Visit: https://generate-secret.vercel.app/32

**Option C: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the generated secret (it will look like: `aBc123XyZ...`)

### Step 2: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project: **infusion-ashy** (or your project name)
3. Click **Settings** → **Environment Variables**
4. For each variable below, click **Edit** or **Add**:

   **Variable 1: NEXTAUTH_URL**
   - Key: `NEXTAUTH_URL`
   - Value: `https://infusion-ashy.vercel.app`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 2: NEXTAUTH_SECRET**
   - Key: `NEXTAUTH_SECRET`
   - Value: `[paste your generated secret from Step 1]`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 3: MONGODB_URI**
   - Key: `MONGODB_URI`
   - Value: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 4: CLOUDINARY_CLOUD_NAME**
   - Key: `CLOUDINARY_CLOUD_NAME`
   - Value: `your-cloudinary-cloud-name`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 5: CLOUDINARY_API_KEY**
   - Key: `CLOUDINARY_API_KEY`
   - Value: `your-cloudinary-api-key`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 6: CLOUDINARY_API_SECRET**
   - Key: `CLOUDINARY_API_SECRET`
   - Value: `your-cloudinary-api-secret`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 7: GOOGLE_CLIENT_ID**
   - Key: `GOOGLE_CLIENT_ID`
   - Value: `your-google-client-id.apps.googleusercontent.com`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 8: GOOGLE_CLIENT_SECRET**
   - Key: `GOOGLE_CLIENT_SECRET`
   - Value: `your-google-client-secret`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

### Step 3: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   https://infusion-ashy.vercel.app/api/auth/callback/google
   ```
4. Click **Save**

**Important:** Keep your localhost redirect URI for development:
```
http://localhost:3000/api/auth/callback/google
```

### Step 4: Update MongoDB Atlas Network Access (if needed)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. Add: `0.0.0.0/0` (allows all IPs - Vercel uses dynamic IPs)
   - **OR** click **Allow Access from Anywhere** button
5. Click **Confirm**

### Step 5: Redeploy Your Application

After updating environment variables:

1. Go to your Vercel project dashboard
2. Click **Deployments** tab
3. Click the **⋯** (three dots) on the latest deployment
4. Click **Redeploy**
5. Wait for the deployment to complete

**OR** simply push a new commit to trigger automatic deployment:
```bash
git commit --allow-empty -m "Trigger redeploy with new env vars"
git push
```

---

## Quick Reference: All Environment Variables

Copy-paste this into Vercel (after generating NEXTAUTH_SECRET):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
NEXTAUTH_URL=https://infusion-ashy.vercel.app
NEXTAUTH_SECRET=[GENERATE_THIS_USING_STEP_1]
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## Verification Checklist

After deployment, verify:

- [ ] Visit `https://infusion-ashy.vercel.app` - site loads
- [ ] Visit `https://infusion-ashy.vercel.app/jaba/login` - login page loads
- [ ] Click "Sign in with Google" - redirects to Google
- [ ] After Google auth - redirects back to your app
- [ ] Dashboard loads with data from MongoDB
- [ ] Images load from Cloudinary

---

## Troubleshooting

### If Google OAuth fails:
- Check that redirect URI is added in Google Console
- Verify `NEXTAUTH_URL` matches your Vercel domain exactly
- Check Vercel function logs for errors

### If MongoDB connection fails:
- Verify MongoDB Atlas allows `0.0.0.0/0` in Network Access
- Check that MongoDB URI is correct in Vercel env vars
- Check Vercel function logs for connection errors

### If images don't load:
- Verify Cloudinary credentials are correct
- Check that images are uploaded to Cloudinary
- Check browser console for CORS errors

---

## Security Notes

⚠️ **Important:**
- Never commit `.env` files to Git
- Keep `NEXTAUTH_SECRET` secret and unique
- Use different secrets for production and development
- Regularly rotate secrets in production

