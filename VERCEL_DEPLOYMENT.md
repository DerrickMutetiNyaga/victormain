# Vercel Deployment Guide

This guide will help you deploy your Jaba Manufacturing Plant application to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. MongoDB Atlas account with a cluster set up
3. Google OAuth credentials (for authentication)
4. Cloudinary account (optional, for image uploads)

## Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub, GitLab, or Bitbucket.

## Step 2: Set Up Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following environment variables:

### Required Environment Variables

```env
# MongoDB Connection
MONGODB_URI=your-mongodb-connection-string

# NextAuth Configuration
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=generate-a-random-secret-string-here

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary (optional - for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

### How to Generate NEXTAUTH_SECRET

Run this command in your terminal:
```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

### MongoDB Atlas Setup

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Add `0.0.0.0/0` to allow connections from anywhere (Vercel servers)
4. Go to **Database Access** and ensure your user has read/write permissions
5. Get your connection string from **Connect** → **Connect your application**

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Add authorized redirect URI: `https://your-app-name.vercel.app/api/auth/callback/google`
6. Copy the Client ID and Client Secret

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)
4. Add all environment variables from Step 2
5. Click **Deploy**

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Follow the prompts and add environment variables when asked

## Step 4: Configure MongoDB Atlas Network Access

After deployment, you may need to update MongoDB Atlas:

1. Go to MongoDB Atlas → **Network Access**
2. Vercel uses dynamic IPs, so you may need to:
   - Add `0.0.0.0/0` (allow all IPs) - **Less secure but works**
   - OR use MongoDB Atlas IP Access List API to add Vercel IPs dynamically

## Step 5: Update NEXTAUTH_URL

After your first deployment, update the `NEXTAUTH_URL` environment variable in Vercel to match your actual deployment URL:
- Production: `https://your-app-name.vercel.app`
- Preview: `https://your-app-name-git-branch-username.vercel.app`

## Step 6: Verify Deployment

1. Visit your deployed URL
2. Check the browser console for any errors
3. Test authentication (Google OAuth)
4. Test database connections (create a batch, view dashboard)

## Troubleshooting

### Build Errors

1. **TypeScript Errors**: The project has `ignoreBuildErrors: true` in `next.config.mjs`, so TypeScript errors won't block builds
2. **Missing Dependencies**: Make sure all dependencies are in `package.json`
3. **API Route Errors**: Check Vercel function logs in the dashboard

### Runtime Errors

1. **MongoDB Connection Issues**:
   - Verify `MONGODB_URI` is set correctly
   - Check MongoDB Atlas Network Access allows `0.0.0.0/0`
   - Verify cluster is not paused
   - Check connection string format

2. **NextAuth Errors**:
   - Verify `NEXTAUTH_URL` matches your deployment URL
   - Check `NEXTAUTH_SECRET` is set
   - Verify Google OAuth credentials are correct
   - Check redirect URI in Google Cloud Console matches your deployment URL

3. **API Route Errors**:
   - Check Vercel Function Logs in dashboard
   - Verify environment variables are set
   - Check MongoDB connection

### Common Issues

**Issue**: "Invalid/Missing environment variable: MONGODB_URI"
- **Solution**: Add `MONGODB_URI` in Vercel environment variables

**Issue**: "MongoDB connection timeout"
- **Solution**: 
  - Add `0.0.0.0/0` to MongoDB Atlas Network Access
  - Check if cluster is paused
  - Verify connection string is correct

**Issue**: "NextAuth configuration error"
- **Solution**: 
  - Set `NEXTAUTH_URL` to your deployment URL
  - Set `NEXTAUTH_SECRET` to a random string
  - Verify Google OAuth redirect URI matches

**Issue**: "API routes return 500 errors"
- **Solution**: 
  - Check Vercel Function Logs
  - Verify MongoDB connection
  - Check environment variables are set

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB connection string |
| `NEXTAUTH_URL` | ✅ Yes | Your deployment URL |
| `NEXTAUTH_SECRET` | ✅ Yes | Random secret for NextAuth |
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google OAuth Client Secret |
| `CLOUDINARY_CLOUD_NAME` | ⚠️ Optional | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ⚠️ Optional | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ⚠️ Optional | Cloudinary API secret |

## Additional Notes

- Vercel automatically detects Next.js and configures build settings
- API routes are automatically deployed as serverless functions
- Environment variables are encrypted and secure
- You can set different values for Production, Preview, and Development environments
- After adding environment variables, redeploy your application

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Vercel Function logs
3. Verify all environment variables are set
4. Check MongoDB Atlas connection settings
5. Review Next.js and Vercel documentation
