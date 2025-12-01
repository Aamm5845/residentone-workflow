# 📱 Mobile Photo Survey App - Setup Guide

## Overview

This document guides you through setting up the **ResidentOne Photo Survey** mobile companion app. This app is similar to **CompanyCam** - allowing team members to capture site photos, tag them to projects and rooms, and sync everything back to your main workflow system.

## Features

- 📸 **Camera Integration** - Take photos directly in the app
- 📍 **GPS Tagging** - Automatic location metadata on photos  
- 🏠 **Project & Room Linking** - Tag photos to specific projects and rooms
- 📤 **Offline Queue** - Photos queue for upload even without internet
- 🔄 **Background Sync** - Upload photos while continuing to capture
- 👥 **Team Access** - All team members can use the app with their existing credentials

## Quick Start

### 1. Install Dependencies

```bash
# Navigate to the mobile app
cd mobile-app

# Install packages
npm install
```

### 2. Start the Development Server

```bash
npx expo start
```

### 3. Run on Your Phone

1. **Install Expo Go** from App Store / Play Store
2. Scan the QR code shown in your terminal
3. The app will load on your device

### 4. Configure Server Connection

1. Open the app
2. Tap **"Configure Server"**
3. Enter your ResidentOne Workflow URL:
   - Production: `https://your-app.vercel.app`
   - Local dev: `http://YOUR_COMPUTER_IP:3000`
4. Tap **"Connect to Server"**

### 5. Login

Use your existing ResidentOne Workflow credentials to sign in.

## Backend Requirements

Make sure you run `npm install` on the main project to install the `jose` package that was added:

```bash
# In the main project directory
npm install
```

### New API Endpoints Added

The following endpoints were added to support mobile authentication:

- `POST /api/auth/mobile-login` - Mobile-specific login endpoint
- `GET /api/auth/me` - Verify authentication token

## App Screens

### Projects Tab
- Browse all your projects
- See project status and photo counts
- Tap to view project details or start capturing

### Camera
- Full-screen camera with flash control
- Select project and room before capturing
- GPS tagging (optional)
- Photos save to device and queue for upload

### Upload Queue
- View all pending photos
- Upload all at once or individually
- Retry failed uploads
- Clear completed uploads

### Profile
- View account info
- Configure settings:
  - Auto-upload on WiFi
  - High quality photos
  - GPS location tagging
- Sign out

## Building for Production

### iOS (requires Mac with Xcode)

```bash
cd mobile-app
npx eas build --platform ios
```

### Android

```bash
cd mobile-app
npx eas build --platform android
```

### App Store / Play Store Submission

```bash
npx eas submit --platform ios
npx eas submit --platform android
```

## App Icons & Splash Screen

Replace the placeholder files in `mobile-app/assets/`:

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024x1024 | Main app icon |
| `splash.png` | 1284x2778 | Splash screen |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon |
| `favicon.png` | 48x48 | Web favicon |

## Customization

### App Name & Bundle ID

Edit `mobile-app/app.json`:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "ios": {
      "bundleIdentifier": "com.yourcompany.photosurvey"
    },
    "android": {
      "package": "com.yourcompany.photosurvey"
    }
  }
}
```

### Theme Colors

The app uses purple (`#7c3aed`) to match your main workflow app. To change, update the color values in each screen's StyleSheet.

## Troubleshooting

### "Cannot connect to server"
- Verify server URL is correct (include `https://`)
- Check server is running
- For local development, use your computer's IP address (not localhost)

### Camera not working
- Grant camera permission in device settings
- On iOS: Settings → Your App → Camera
- On Android: Settings → Apps → Your App → Permissions → Camera

### Photos not uploading
- Check internet connection
- Go to Upload Queue tab
- Tap "Upload All" or retry failed items

### "Invalid credentials" error
- Verify using correct email/password
- Account must be approved in the main system
- Check user has appropriate role

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────────┐
│   Mobile App        │     │    ResidentOne Workflow     │
│   (Expo/React)      │────►│    (Next.js Backend)        │
│                     │     │                             │
│  - Camera Capture   │     │  API Endpoints:             │
│  - Offline Queue    │     │  - /api/auth/mobile-login   │
│  - GPS Tagging      │     │  - /api/auth/me             │
│  - Photo Upload     │     │  - /api/projects            │
│                     │     │  - /api/projects/[id]/rooms │
│                     │     │  - /api/.../survey-photos   │
└─────────────────────┘     └─────────────────────────────┘
```

## Future Enhancements

- [ ] **Photo Annotations** - Draw/markup on photos
- [ ] **Before/After Pairs** - Link related photos
- [ ] **Push Notifications** - Upload status, mentions
- [ ] **Offline Projects** - Cache project data
- [ ] **AI Analysis** - Auto-categorize photos, detect issues
- [ ] **Voice Notes** - Audio recordings attached to photos

---

## Support

For issues with the mobile app, check:
1. This documentation
2. `mobile-app/README.md`
3. The main project's issue tracker

Happy capturing! 📸

