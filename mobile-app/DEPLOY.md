# Deploy ResidentOne Mobile to Vercel

## Quick Deploy Steps

### 1. Push to GitHub (if not already)

Make sure the `mobile-app` folder is in your repository.

### 2. Create New Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your repository
4. **Important Settings:**
   - **Root Directory**: `mobile-app`
   - **Framework Preset**: Other
   - **Build Command**: `npx expo export -p web`
   - **Output Directory**: `dist`

### 3. Add Custom Domain

1. In Vercel project settings → Domains
2. Add: `mobile.meisnerinteriors.com`
3. Add DNS record in your domain provider:
   - Type: `CNAME`
   - Name: `mobile`
   - Value: `cname.vercel-dns.com`

### 4. Environment Variables (Optional)

If needed, add in Vercel:
- `EXPO_PUBLIC_API_URL` = `https://app.meisnerinteriors.com`

## How Users Install the PWA

### iPhone/iPad:
1. Open Safari → go to `mobile.meisnerinteriors.com`
2. Tap Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen!

### Android:
1. Open Chrome → go to `mobile.meisnerinteriors.com`
2. Tap menu (3 dots)
3. Tap "Add to Home screen" or "Install app"
4. Tap "Add"
5. App icon appears on home screen!

## Features

- 📸 Photo capture with GPS tagging
- 🏷️ Tags and annotations
- 📏 Measurements on photos
- 🔗 Link photos to projects & rooms
- ☁️ Uploads to Dropbox (if configured)
- 📱 Works offline, syncs when connected











