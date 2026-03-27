# Security: Rotate Exposed Credentials

These credentials were exposed in the GitHub repository. **You must rotate them** to protect your data.

## 1. MongoDB Atlas

1. Go to [MongoDB Atlas → Database Access](https://cloud.mongodb.com/)
2. Find the user whose credentials were exposed (e.g. `infusionjaba_db1`)
3. Click **Edit** → **Edit Password** → Generate new password
4. Update `MONGODB_URI` in:
   - Your local `.env`
   - Vercel → Project → Settings → Environment Variables
   - Any other deployment environments

## 2. Cloudinary

1. Go to [Cloudinary Console](https://console.cloudinary.com/) → Settings → API Keys
2. Regenerate the **API Secret** (or create new API key pair)
3. Update in your local `.env` and Vercel environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

## 3. Google OAuth (if exposed)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create new OAuth 2.0 Client ID or regenerate client secret
3. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your env vars
