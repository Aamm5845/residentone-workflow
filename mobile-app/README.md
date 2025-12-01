# 📱 ResidentOne Photo Survey - Mobile Companion App

A React Native/Expo mobile app for on-site photo documentation, similar to CompanyCam. This app connects to your ResidentOne Workflow system to capture and upload site photos linked to projects and rooms.

## ✨ Features

### 📸 Photo Capture
- **Camera integration** with front/back switching
- **Flash control** (on/off/auto)
- **GPS tagging** - automatically tags photos with location
- **High-quality capture** - configurable quality settings
- **Video support** - capture videos in addition to photos

### 📂 Project Integration
- **Browse all projects** from your ResidentOne Workflow
- **Room selection** - tag photos to specific rooms
- **Real-time sync** - photos upload to your server

### 🔄 Offline Support
- **Queue system** - photos are queued for upload
- **Persistent storage** - queue survives app restarts
- **Retry logic** - automatic retry for failed uploads
- **Background upload** - continue capturing while uploading

### ⚙️ Settings
- **Auto-upload on WiFi** - configurable
- **High-quality mode** - toggle between quality and file size
- **GPS tagging** - enable/disable location tagging

## 🚀 Getting Started

### Prerequisites

1. **Node.js 18+** installed
2. **Expo CLI**: `npm install -g expo-cli`
3. **Expo Go app** on your phone (iOS/Android)
4. **ResidentOne Workflow** server running

### Installation

```bash
# Navigate to the mobile app directory
cd mobile-app

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Your Phone

1. Start the development server: `npx expo start`
2. Scan the QR code with:
   - **iOS**: Camera app
   - **Android**: Expo Go app
3. The app will load on your device

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 📱 App Structure

```
mobile-app/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx      # Login screen
│   │   └── setup.tsx      # Server configuration
│   ├── (tabs)/            # Main tab navigator
│   │   ├── index.tsx      # Projects list
│   │   ├── queue.tsx      # Upload queue
│   │   └── profile.tsx    # User profile & settings
│   ├── camera.tsx         # Camera capture screen
│   └── project/[id].tsx   # Project details
├── store/                 # Zustand state stores
│   ├── auth.ts            # Authentication state
│   ├── projects.ts        # Projects & rooms
│   ├── upload.ts          # Upload queue management
│   └── settings.ts        # App settings
├── lib/                   # Utilities
│   └── api.ts             # API client
├── types/                 # TypeScript types
│   └── index.ts
└── assets/                # App icons & splash
```

## 🔧 Configuration

### Server Setup

The app is pre-configured to connect to `https://app.meisnerinteriors.com`.

To use a different server:
1. Open the app
2. Tap "Configure Server" 
3. Enter your server URL

### Required Backend Endpoints

The mobile app requires these API endpoints on your backend:

- `GET /api/health` - Server health check
- `POST /api/auth/mobile-login` - Mobile authentication
- `GET /api/auth/me` - Verify auth token
- `GET /api/projects` - List all projects
- `GET /api/projects/[id]/rooms` - Get project rooms
- `POST /api/projects/[id]/updates` - Create project update
- `POST /api/projects/[id]/updates/[updateId]/survey-photos` - Upload photo

## 📷 How to Use

### Capturing Photos

1. **Select a project** from the Projects tab
2. **Tap the camera button** (center of bottom nav)
3. **Choose a room** using the dropdown at top
4. **Take photos** using the capture button
5. Photos are **automatically added** to the upload queue

### Managing the Upload Queue

1. Go to the **Upload Queue** tab
2. See all **pending, uploading, and uploaded** photos
3. Tap **"Upload All"** to start batch upload
4. **Retry** failed uploads with the retry button
5. **Clear completed** photos with the checkmark button

### Settings

- **Auto Upload**: Automatically upload when on WiFi
- **High Quality**: Capture at max resolution (larger files)
- **GPS Location**: Tag photos with coordinates

## 🎨 Customization

### App Icon & Splash Screen

Replace these files in the `assets/` folder:
- `icon.png` - 1024x1024 app icon
- `splash.png` - 1284x2778 splash screen
- `adaptive-icon.png` - 1024x1024 Android adaptive icon
- `favicon.png` - 48x48 web favicon

### Theming

The app uses a purple theme (`#7c3aed`) matching ResidentOne Workflow. To customize, update the color values in the screen stylesheets.

## 🔐 Security

- **Secure token storage** using `expo-secure-store`
- **JWT authentication** with 30-day expiration
- **HTTPS required** for production
- **No sensitive data** in AsyncStorage

## 📝 API Integration Details

### Authentication Flow

1. User enters server URL
2. App tests connection with `/api/health`
3. User logs in with email/password
4. Backend returns JWT token
5. Token stored securely on device
6. All API requests include `Authorization: Bearer <token>`

### Photo Upload Flow

1. Photo captured → saved to device library
2. Added to upload queue with metadata
3. On upload: Create `ProjectUpdate` via API
4. Upload photo file via FormData to survey-photos endpoint
5. Mark as uploaded on success

## 🐛 Troubleshooting

### "Connection Failed" Error
- Check server URL is correct (include https://)
- Ensure server is running and accessible
- Check firewall/network settings

### Camera Not Working
- Grant camera permissions in device settings
- Restart the app
- On iOS, check Privacy > Camera settings

### Photos Not Uploading
- Check internet connection
- Verify server is accessible
- Check upload queue for error messages
- Try "Retry" button for failed uploads

### GPS Not Working
- Enable location services on device
- Grant location permission to the app
- Check "Include GPS" is enabled in settings

## 🛣️ Roadmap

- [ ] **Photo annotation/markup tools** - Draw on photos
- [ ] **Offline project caching** - View projects offline
- [ ] **Push notifications** - Upload status alerts
- [ ] **Before/After photo pairing** - Link related photos
- [ ] **AI analysis** - Automatic defect detection
- [ ] **Voice notes** - Record audio with photos

## 📄 License

This app is part of the ResidentOne Workflow system.

---

Built with ❤️ using [Expo](https://expo.dev) and [React Native](https://reactnative.dev)

