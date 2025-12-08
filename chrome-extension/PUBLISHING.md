# Publishing Meisner FFE Clipper to Chrome Web Store

## Quick Setup

### 1. Create Developer Account
- Go to: https://chrome.google.com/webstore/devconsole/
- Sign in with a Google account
- Pay the one-time $5 registration fee

### 2. Prepare the Extension

Before uploading, verify:
- `background.js` has `ENVIRONMENT = 'production'`
- Icons are in the `icons/` folder

### 3. Create ZIP Package

**Windows (PowerShell):**
```powershell
cd c:\Users\ADMIN\Desktop\residentone-workflow
Compress-Archive -Path .\chrome-extension\* -DestinationPath .\meisner-ffe-clipper.zip -Force
```

**Or manually:**
1. Open the `chrome-extension` folder
2. Select ALL files inside (not the folder itself)
3. Right-click → Send to → Compressed (zipped) folder
4. Name it `meisner-ffe-clipper.zip`

### 4. Upload to Chrome Web Store

1. Go to https://chrome.google.com/webstore/devconsole/
2. Click "New Item"
3. Upload your ZIP file
4. Fill in the listing details:

**Store Listing:**
- **Name:** Meisner FFE Clipper
- **Summary:** Clip product information from any website and save it to your StudioFlow FFE schedules
- **Description:**
  ```
  Meisner FFE Clipper makes it easy to collect product information from any website.
  
  Features:
  • Smart AI-powered extraction of product details
  • Manual text selection with click-to-capture
  • Image clipping via right-click context menu
  • Crop tool for capturing specific areas
  • Attachment detection for PDFs and downloads
  • Drag-to-reorder images
  • Direct integration with StudioFlow FFE workspace
  
  Perfect for interior designers and procurement teams managing furniture, fixtures, and equipment schedules.
  ```
- **Category:** Productivity
- **Language:** English

**Privacy:**
- You'll need a Privacy Policy URL
- Simple template: Host on your website or use a service like Termly

**Screenshots:**
- Required: At least 1 screenshot (1280x800 or 640x400)
- Take screenshots showing the extension in action

### 5. Visibility Options

**Public:** Anyone can find and install it
**Unlisted:** Only people with the direct link can install (recommended for internal tools)

For unlisted:
- Select "Unlisted" in visibility settings
- Share the direct link with your team

### 6. Submit for Review

- Click "Submit for Review"
- Review typically takes 1-3 business days
- You'll receive email when approved

---

## Option 2: Direct Installation (For Testing/Small Teams)

For quick team testing without Chrome Web Store:

1. Share the `chrome-extension` folder with team members
2. Each person:
   - Opens `chrome://extensions/`
   - Enables "Developer mode" (top right toggle)
   - Clicks "Load unpacked"
   - Selects the `chrome-extension` folder

**Note:** This requires manual updates when you release new versions.

---

## Option 3: Enterprise Deployment (Google Workspace)

If you use Google Workspace for your organization:

1. Go to Google Admin Console
2. Navigate to: Devices → Chrome → Apps & extensions
3. Add the extension by ID or upload CRX
4. Force install for specific organizational units

---

## After Publishing

Share the installation link with your team:
```
https://chrome.google.com/webstore/detail/meisner-ffe-clipper/[EXTENSION_ID]
```

The extension ID will be shown in the developer dashboard after publishing.

---

## Updating the Extension

1. Make changes to the code
2. Update version in `manifest.json` (e.g., "1.0.1")
3. Create new ZIP
4. Go to Developer Dashboard
5. Click on your extension
6. Click "Package" → "Upload new package"
7. Submit for review

Updates for existing users are automatic once approved.
