# Fix Upload Sync Between Local and Production

## Problem
- **Local**: Uploads go to `/public/uploads/` (local filesystem)
- **Production**: Uploads go to Vercel Blob Storage
- Result: Images uploaded locally don't appear on Vercel

## Solution: Add Vercel Blob Token to Local Environment

### Step 1: Get Your Vercel Blob Token

1. Go to your Vercel project dashboard: https://vercel.com/
2. Select your project (residentone-workflow)
3. Go to **Settings** → **Environment Variables**
4. Find `BLOB_READ_WRITE_TOKEN`
5. Copy the token value

### Step 2: Add Token to Local .env

Add this line to your `.env` file:

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxx"
```

### Step 3: Restart Your Development Server

```bash
# Stop the server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 4: Test Upload

1. Go to any project settings
2. Upload a cover image
3. The image should now go to Vercel Blob Storage
4. Check if it appears both locally AND on Vercel

## Alternative Solution: Use Environment-Specific Uploads

If you want to keep local and production separate during development:

### Option A: Keep Local Storage for Development

**Current setup** - no changes needed
- Local uses filesystem (fast for development)
- Production uses Blob Storage (required for Vercel)
- **Caveat**: Images won't sync between environments

### Option B: Always Use Blob Storage

Add the token to `.env` as described above
- Both local and production use Blob Storage
- Images sync perfectly
- **Caveat**: Slower local uploads (needs network request)

## Verification

After adding the token, check the upload response:

```javascript
// In browser console after upload:
{
  "success": true,
  "url": "https://h5gk2ckvznawc5l9.public.blob.vercel-storage.com/...",
  "storage": "vercel-blob"  // Should be "vercel-blob", not "local"
}
```

## Current Status

Your production images from the November 4th backup are still accessible:
- URL: `https://h5gk2ckvznawc5l9.public.blob.vercel-storage.com/...`
- All 10 images are intact in Blob Storage
- They will display correctly on production

## Recommendation

**For consistency**: Add `BLOB_READ_WRITE_TOKEN` to your local `.env` so all uploads go to the same place (Vercel Blob Storage). This ensures your local development matches production exactly.
