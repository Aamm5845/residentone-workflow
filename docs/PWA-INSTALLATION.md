# PWA Installation Guide

## Desktop Installation

Your StudioFlow application can now be installed as a desktop app with an icon on your computer!

### How to Install on Windows

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Open in a supported browser**
   - Chrome (recommended)
   - Edge (recommended)
   - Brave
   - Opera

3. **Install the app**
   - Look for the **install icon** (⊕ or computer icon) in the browser's address bar
   - Click it and select **"Install"**
   - Alternatively, click the browser menu (⋮) and select **"Install StudioFlow"**

4. **Create desktop shortcut**
   - The app will open in its own window
   - A shortcut will be added to your Start Menu
   - You can pin it to your desktop or taskbar

### What You Get

✅ **Desktop Icon** - Launch the app like any other software  
✅ **Standalone Window** - Opens without browser UI  
✅ **Start Menu Entry** - Easy access from Windows Start  
✅ **Taskbar Pin** - Pin to taskbar for quick access  
✅ **Native Feel** - Works like a native desktop application  

### Alternative: Manual Desktop Shortcut

If you prefer a simple browser shortcut:

1. Open the app in your browser
2. Copy the URL (usually `http://localhost:3000` or your deployed URL)
3. Right-click on desktop → New → Shortcut
4. Paste the URL and name it "StudioFlow"
5. Optional: Change the icon by right-clicking the shortcut → Properties → Change Icon

### For Production

When you deploy your app:
- Users can install it from your production URL
- The PWA works best with HTTPS
- Installation prompts appear automatically in supported browsers

### Uninstalling

- **Chrome/Edge**: Go to `chrome://apps` or `edge://apps`, right-click the app, and select "Uninstall"
- **From Windows**: Settings → Apps → Apps & features → Find "StudioFlow" → Uninstall

### Technical Details

The app uses Progressive Web App (PWA) technology:
- `manifest.json` - Defines app metadata and icons
- Icons in multiple sizes (192x192, 256x256, 384x384, 512x512)
- Works both online and with future offline capabilities
