# Environment Variables Required for Deployment

Copy these environment variables to your Vercel project settings:

## Required Variables

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/infusion_jaba?retryWrites=true&w=majority
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=generate-random-secret-here
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Optional Variables

```env
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## How to Generate NEXTAUTH_SECRET

Run this command:
```bash
openssl rand -base64 32
```

Or visit: https://generate-secret.vercel.app/32
