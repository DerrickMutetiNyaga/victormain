# Database Seeding and Image Upload Scripts

This directory contains scripts for seeding the MongoDB database with Jaba manufacturing data and uploading images to Cloudinary.

## Prerequisites

1. Make sure your `.env` file has all required environment variables:
   ```env
   MONGODB_URI=your-mongodb-connection-string
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

## Scripts

### 1. Seed Database (`seed-jaba-data.ts`)

This script seeds your MongoDB database with all the static data from `lib/jaba-data.ts`.

**What it seeds:**
- Batches (30 batches)
- Raw Materials (18 materials)
- Distributors (10 distributors)
- Delivery Notes (15 notes)
- Material Usage Logs
- QC Results
- Packaging Outputs
- Finished Goods
- Stock Movements
- Production Outputs
- Packaging Sessions

**Usage:**
```bash
npm run seed
```

**Note:** This script will **delete all existing data** in the collections before seeding. If you want to keep existing data, modify the script to comment out the `deleteMany` calls.

### 2. Upload Images to Cloudinary (`upload-images-to-cloudinary.ts`)

This script uploads all images from the `public` directory to Cloudinary.

**What it does:**
- Scans the `public` directory for image files (.jpg, .jpeg, .png, .gif, .webp, .svg)
- Uploads each image to Cloudinary in the `jaba` folder
- Creates a `cloudinary-mapping.json` file mapping local paths to Cloudinary URLs

**Usage:**
```bash
npm run upload-images
```

**Output:**
- Images uploaded to Cloudinary folder: `jaba/`
- Mapping file created: `cloudinary-mapping.json`

## Running Both Scripts

To seed the database and upload images:

```bash
# Upload images first (optional)
npm run upload-images

# Then seed the database
npm run seed
```

## Troubleshooting

### MongoDB Connection Error
- Verify your `MONGODB_URI` is correct in `.env`
- Make sure MongoDB Atlas allows connections from your IP address

### Cloudinary Upload Error
- Verify your Cloudinary credentials in `.env`
- Check that the `public` directory exists and contains images

### TypeScript Errors
- Make sure `tsx` is installed: `npm install --save-dev tsx`
- Run `npm install` to ensure all dependencies are installed

