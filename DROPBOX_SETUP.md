# Dropbox Authentication Setup Guide

The application is currently experiencing 401 Unauthorized errors when browsing Dropbox folders because the environment variables are not properly configured.

## Current Status

✅ **Environment Variables Configured**
- `.env.local` file found with all necessary variables
- Dropbox authentication credentials present
- CloudConvert API key configured
- Vercel Blob token configured

❌ **Still Getting 401 Errors**
- Authentication appears to be failing despite having credentials
- Need to debug the specific Dropbox API authentication flow

## Required Setup Steps

### 1. Copy Environment Template
```bash
cp .env.local.template .env.local
```

### 2. Configure Dropbox API Credentials

You need to obtain the following from your Dropbox Business account:

#### Option A: Access Token (Quick Setup)
```env
DROPBOX_ACCESS_TOKEN="your-dropbox-access-token-here"
DROPBOX_TEAM_MEMBER_ID="team.member@yourdomain.com"
```

#### Option B: Refresh Token (Recommended)
```env
DROPBOX_APP_KEY="your-dropbox-app-key-here"
DROPBOX_APP_SECRET="your-dropbox-app-secret-here" 
DROPBOX_REFRESH_TOKEN="your-dropbox-refresh-token-here"
DROPBOX_TEAM_MEMBER_ID="team.member@yourdomain.com"
```

### 3. Get Dropbox Credentials

1. **Go to Dropbox App Console**: https://www.dropbox.com/developers/apps
2. **Create or select your app**
3. **For Business/Team accounts**:
   - Enable "Team member management" permission
   - Get the Team Member ID from your business admin
   - The app needs to be approved by your Dropbox Business admin

### 4. Additional Configuration

```env
# CloudConvert for CAD conversion
CLOUDCONVERT_API_KEY="your-cloudconvert-api-key-here" 
CLOUDCONVERT_SANDBOX="true"

# Vercel Blob for PDF storage
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token-here"
```

## Debugging Authentication Issues

Since environment variables are configured but 401 errors persist:

1. **Test Dropbox Authentication**:
   - Visit: `http://localhost:3001/api/debug/test-dropbox`
   - This will test various authentication methods and shared link access
   - Check which specific authentication step is failing

2. **Check Environment Status**:
   - Visit: `http://localhost:3001/api/debug/dropbox-env`
   - Verify all environment variables are properly loaded

## Testing the Fix

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Run debug tests first**:
   - Check `/api/debug/test-dropbox` for authentication issues
   - Check `/api/debug/dropbox-env` for environment status

3. **Test CAD file browsing**:
   - Go to Project Settings → CAD File Settings
   - Click "Browse Files" on any plan type
   - Should now load Dropbox folders without 401 errors

4. **Test CAD options**:
   - Click the gear icon next to a linked CAD file
   - Click "Select CTB File" 
   - Should browse Dropbox for .ctb files

## Troubleshooting

### Still getting 401 errors?
- Check if `DROPBOX_TEAM_MEMBER_ID` matches an actual team member email
- Verify the access token hasn't expired
- Ensure your Dropbox app has the right permissions

### Console errors about shared links?
- The app uses a hardcoded shared link in `dropbox-service.ts`
- May need to update the shared link URL if it has changed
- Check line 137 in `src/lib/dropbox-service.ts`

## Impact

✅ **After Setup**:
- CAD file browsing will work in settings
- CTB file selection will work in CAD options dialog
- Unlinked CAD files will no longer appear in generated PDFs

❌ **Without Setup**:
- 401 Unauthorized errors when browsing folders
- Cannot select CTB files for plot styles
- CAD options dialog cannot load layouts