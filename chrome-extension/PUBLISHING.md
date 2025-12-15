# Publishing & Distributing Meisner FFE Clipper

## Quick Team Distribution (Recommended for Internal Use)

### Step 1: Build the Release Package

Run the build script in PowerShell:

```powershell
cd c:\Users\ADMIN\Desktop\residentone-workflow\chrome-extension

# For local/development testing
.\build-release.ps1

# For production release
.\build-release.ps1 -Production
```

This creates: `meisner-ffe-clipper-v1.2.0.zip` in the parent folder

### Step 2: Share with Your Team

**Option A: Shared Drive**
1. Upload `meisner-ffe-clipper-v1.2.0.zip` to a shared Google Drive / OneDrive folder
2. Share the folder link with your team
3. When you release updates, upload the new ZIP to the same folder

**Option B: Email**
1. Email the ZIP file to team members
2. Include installation instructions (see README.md)

**Option C: StudioFlow Downloads Page**
1. Add the ZIP to a downloads page in your app
2. Team members can download from Settings → Extensions

### Step 3: Update Notifications

The extension automatically checks for updates when opened. To enable this:

1. Create an API endpoint at `/api/extension/version` that returns:
   ```json
   {
     "latestVersion": "1.2.0",
     "downloadUrl": "https://your-domain.com/downloads/meisner-ffe-clipper.zip"
   }
   ```

2. When you release a new version, update this endpoint
3. Users will see an "Update available" notification in the extension

---

## Updating the Extension

### For Developers

1. Make your changes
2. Update version in `manifest.json` (e.g., "1.2.1")
3. Update version in `popup.js` (`EXTENSION_VERSION`)
4. Update version comment at top of `popup.js`
5. Run `.\build-release.ps1 -Production`
6. Upload new ZIP to distribution channel
7. Update the version API endpoint

### For Team Members

See the README.md for detailed update instructions. Quick version:
1. Download new ZIP
2. Extract over existing folder
3. Go to `chrome://extensions/`
4. Click refresh icon on Meisner FFE Clipper
5. Refresh any open web pages

---

## Chrome Web Store Publishing

For public distribution or managed installations:

### 1. Create Developer Account
- Go to: https://chrome.google.com/webstore/devconsole/
- Sign in with a Google account
- Pay the one-time $5 registration fee

### 2. Prepare the Extension

Before uploading, verify:
- `popup.js` has `ENVIRONMENT = 'production'`
- Run `.\build-release.ps1 -Production`

### 3. Upload to Chrome Web Store

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
  • Link products to FFE items in your workspace
  • Multi-room product linking
  
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

### 4. Visibility Options

**Public:** Anyone can find and install it
**Unlisted:** Only people with the direct link can install (recommended for internal tools)

### 5. Submit for Review
- Click "Submit for Review"
- Review typically takes 1-3 business days
- You'll receive email when approved

---

## Enterprise Deployment (Google Workspace)

If you use Google Workspace for your organization:

1. Go to Google Admin Console
2. Navigate to: Devices → Chrome → Apps & extensions
3. Add the extension by ID or upload CRX
4. Force install for specific organizational units

---

## Version Checklist

Before each release:

- [ ] Update version in `manifest.json`
- [ ] Update `EXTENSION_VERSION` in `popup.js`
- [ ] Update version comment at top of `popup.js`
- [ ] Update VERSION HISTORY in `README.md`
- [ ] Run `.\build-release.ps1 -Production`
- [ ] Test the production build
- [ ] Upload to distribution channel
- [ ] Update version API endpoint
- [ ] Notify team of update
