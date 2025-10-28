# Desktop Notifications Setup Guide

## Overview

Get Windows desktop notifications when someone @mentions you in chat - even when your browser is minimized or in the background.

## How It Works

This uses **native browser notifications** (Web Notifications API) which work on:
- ✅ Chrome/Edge (Windows, Mac, Linux)
- ✅ Firefox (Windows, Mac, Linux)
- ✅ Opera, Brave, Vivaldi
- ❌ Safari (limited support)

## Setup Steps

### 1. Enable Notifications in Your Browser

When you first visit the app, a permission prompt will appear:
1. Click **Allow** when asked for notification permission
2. If you missed it, look for the 🔔 icon in your address bar and click "Allow"

### 2. Add to Settings Page (Optional)

You can add the NotificationSettings component to your user settings:

```tsx path=null start=null
import NotificationSettings from '@/components/settings/NotificationSettings'

// In your settings page:
<NotificationSettings />
```

### 3. Test Notifications

1. Enable notifications in the settings
2. Click "Send Test Notification"
3. You should see a Windows notification pop up!

## Usage

Once enabled:
- ✅ Automatic desktop alerts when someone @mentions you
- ✅ Works even with browser minimized
- ✅ Click notification to jump to the conversation
- ✅ Notifications auto-close after 5 seconds
- ✅ Sound plays (if Windows settings allow)

## Browser-Based Solution (Current)

**Pros:**
- ✅ No installation required
- ✅ Works immediately on Vercel
- ✅ Cross-platform (Windows/Mac/Linux)
- ✅ No additional development needed
- ✅ Secure (uses browser permissions)

**Cons:**
- ⚠️ Only works when browser is running
- ⚠️ User must grant permission
- ⚠️ Limited customization

## Option 2: Desktop App (Future Enhancement)

If you want notifications even when the browser is closed, you'd need to build an Electron desktop app:

### Desktop App Features
- 📦 Standalone Windows app (.exe)
- 🔔 System tray notifications
- 🚀 Auto-start with Windows
- 🔄 Real-time WebSocket connection
- 💾 Offline support

### Desktop App Setup (If Needed)

1. **Install Electron dependencies:**
```bash
npm install --save-dev electron electron-builder
```

2. **Create electron main process:**
```js path=null start=null
// electron/main.js
const { app, BrowserWindow, Notification } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: 'icon.ico'
  })
  
  win.loadURL('https://yourdomain.com')
}

app.whenReady().then(createWindow)
```

3. **Add build scripts to package.json:**
```json path=null start=null
{
  "scripts": {
    "electron": "electron .",
    "electron:build": "electron-builder --win"
  },
  "build": {
    "appId": "com.yourcompany.studioflow",
    "productName": "StudioFlow",
    "win": {
      "target": "nsis",
      "icon": "icon.ico"
    }
  }
}
```

## Recommended Approach

For a **Vercel-hosted web app**, the **browser notifications** (already implemented) are the best solution:

1. ✅ No additional development needed
2. ✅ Works immediately
3. ✅ Users can pin the browser tab or use PWA features
4. ✅ Cross-platform compatibility

The desktop app is only needed if you specifically require:
- Notifications when browser is completely closed
- System tray presence
- Offline functionality

## Windows Notification Settings

Ensure Windows notifications are enabled:
1. Open **Windows Settings** > **System** > **Notifications**
2. Make sure notifications are **On**
3. Ensure your browser (Chrome/Edge) is allowed to show notifications

## Troubleshooting

### Not receiving notifications?

1. **Check browser permission:**
   - Click the lock icon in address bar
   - Ensure "Notifications" is set to "Allow"

2. **Check Windows notifications:**
   - Settings > System > Notifications > On
   - Focus Assist should be "Off" or "Priority only"

3. **Check browser is running:**
   - Browser notifications only work when browser is open
   - Pin the tab to keep it running

4. **Clear browser cache:**
   - Sometimes permission state gets cached
   - Clear cache and refresh

### Notifications appearing but no sound?

1. Check Windows volume mixer
2. Enable sounds in Windows notification settings
3. Test with the "Send Test Notification" button

## FAQ

**Q: Will this work on my phone?**
A: Yes! Mobile browsers also support web notifications.

**Q: Do I need to keep the tab open?**
A: Yes, but you can minimize the browser window.

**Q: Can I customize the notification sound?**
A: Sound is controlled by Windows notification settings.

**Q: Does this work on Mac?**
A: Yes, same setup works on macOS.

**Q: Can I get notifications via email instead?**
A: Check SMS_SETUP_GUIDE.md - email notifications can be added similarly to SMS.

## Next Steps

1. Deploy your code to Vercel
2. Test notifications on your domain
3. Share the notification settings page with your team
4. Consider adding PWA support to "install" the web app
