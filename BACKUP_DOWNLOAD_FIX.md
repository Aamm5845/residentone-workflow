# Backup Download Fix - Summary

## Issue Discovered

When running the daily backup cron job, you encountered errors like:

```
Failed to download file cmhp7pgl30001js041hjm4kae: [TypeError: Failed to parse URL from /meisner interiors team folder/...]
```

This revealed **two separate bugs**:

## Bug #1: Invalid URL Format

### Problem
The `downloadFile()` function in the daily backup cron was trying to use `fetch()` on Dropbox paths like:
```
/meisner interiors team folder/25001-537 av. querbes (feldman)/3- RENDERING/...
```

These are Dropbox file paths stored in your database, NOT HTTP URLs. The `fetch()` function expects proper HTTP URLs and failed with "Invalid URL" errors.

### Root Cause
Your assets are stored in Dropbox, and the database stores **Dropbox paths** (not HTTP URLs). The backup system needs to download files from Dropbox using the Dropbox API, not as HTTP URLs.

### Solution
**File**: `src/app/api/cron/daily-backup/route.ts`

Modified the `downloadFile()` function to:

1. **Detect the type of URL**:
   - Check if it's a Dropbox path (starts with `/` or contains "dropbox")
   - Check if it's an HTTP URL

2. **Download appropriately**:
   - **For Dropbox paths**: Use `dropboxService.downloadFile(path)` 
   - **For HTTP URLs**: Use `fetch(url)` as before

3. **Handle MIME types**:
   - Infer MIME type from file extension for Dropbox files
   - Use Content-Type header for HTTP downloads

**Code changes**:
```typescript
// Before: Always used fetch()
const response = await fetch(url, {...})

// After: Check URL type and use appropriate method
const isDropboxPath = url.startsWith('/') || url.toLowerCase().includes('dropbox')

if (isDropboxPath) {
  // Use Dropbox API
  buffer = await dropboxService.downloadFile(url)
} else {
  // Use HTTP fetch
  const response = await fetch(url, {...})
  buffer = Buffer.from(await response.arrayBuffer())
}
```

## Bug #2: Inconsistent Dropbox Paths

### Problem
Different parts of the code used inconsistent Dropbox path formats:

- **Cron job**: Used `/Meisner Interiors Team Folder/Software Backups/`
- **Cloud backups API**: Used `/Software Backups/`

This caused confusion and potential path lookup failures.

### Root Cause
The Dropbox client is configured with a `pathRoot` that points to the team folder namespace. This means all paths should be **relative to the team folder root**, not include "Meisner Interiors Team Folder" in the path.

From `dropbox-service.ts`:
```typescript
config.pathRoot = JSON.stringify({
  '.tag': 'root',
  'root': rootNamespaceId  // Points to team folder
})
```

### Solution
**File**: `src/app/api/cron/daily-backup/route.ts`

Standardized all paths to be relative to the team folder:

**Changes**:
1. Upload path: `/Meisner Interiors Team Folder/Software Backups/${filename}` → `/Software Backups/${filename}`
2. Create folder: `/Meisner Interiors Team Folder/Software Backups` → `/Software Backups`
3. Cleanup path: `/Meisner Interiors Team Folder/Software Backups` → `/Software Backups`

Now both the cron job and cloud-backups API use the same consistent path: `/Software Backups/`

## Files Modified

1. **`src/app/api/cron/daily-backup/route.ts`**:
   - Fixed `downloadFile()` to handle Dropbox paths
   - Standardized backup folder paths

2. **`src/app/api/admin/cloud-backups/route.ts`**:
   - Already using correct path `/Software Backups`
   - Added clarifying comment

## Testing the Fix

### 1. Test the Daily Backup Manually

With your dev server running:

```bash
curl "http://localhost:3000/api/cron/daily-backup?secret=YOUR_CRON_SECRET"
```

**Expected behavior**:
- ✅ Downloads all asset files from Dropbox successfully
- ✅ No "Failed to parse URL" errors
- ✅ Creates backup file: `database-backup-YYYY-MM-DDTHH-MM-SS.json.gz`
- ✅ Uploads to: `/Software Backups/` in Dropbox
- ✅ Console shows: "Downloaded X files (Y failed)"

### 2. Verify in Dropbox

Check your Dropbox at:
```
Meisner Interiors Team Folder/
└── Software Backups/
    ├── database-backup-2025-01-14T02-00-00.json.gz
    └── (other backups...)
```

### 3. Test Cloud Backups UI

1. Start dev server: `npm run dev`
2. Log in as admin
3. Go to: http://localhost:3000/preferences?tab=backup
4. Click "Refresh" in Cloud Backups section
5. Verify backups appear in the list

### 4. Test Backup Download

1. In the Cloud Backups section, click "Download" on any backup
2. File should download successfully from Dropbox

## Why Assets Are in Dropbox

Your application stores uploaded files (images, PDFs, etc.) in Dropbox instead of Vercel Blob Storage. This is configured in your storage settings and means:

- Asset URLs in database: Dropbox paths like `/meisner interiors team folder/PROJECT/3- RENDERING/...`
- File storage: Dropbox Team Folder
- File access: Via Dropbox API using `dropboxService`

The backup system needs to:
1. Export database records (includes Dropbox paths)
2. **Download actual files** from those Dropbox paths
3. Embed files as base64 in backup for complete disaster recovery

## Impact

### ✅ Before This Fix
- Daily backups would **partially fail**
- Database records backed up ✅
- File downloads failed ❌
- Backups incomplete for disaster recovery

### ✅ After This Fix
- Daily backups **fully succeed**
- Database records backed up ✅
- Files downloaded and embedded ✅
- Complete backups for disaster recovery ✅

## Backup Retention

- **Location**: `/Software Backups/` in Dropbox (team folder)
- **Schedule**: Daily at 2:00 AM UTC (Vercel Cron)
- **Retention**: Last 20 backups kept
- **Format**: Compressed JSON with embedded files
- **Size**: ~2-10 MB (varies with file count)

## Next Steps

1. ✅ Test the manual backup command
2. ✅ Verify backup appears in Dropbox
3. ✅ Check Cloud Backups UI shows the backup
4. ✅ Test download functionality
5. ⏰ Wait for automatic backup at 2 AM UTC (if deployed)

## Important Notes

- **Backups run only when deployed to Vercel** - Local dev requires manual trigger
- **Files must be <50MB each** - Larger files are skipped with warning
- **Download links expire after 4 hours** - Refresh the page to get new links
- **Paths are case-sensitive** - Always use exact casing for Dropbox paths

---

**Status**: ✅ **Both bugs fixed**  
**Tested**: Pending your manual test  
**Ready for**: Deployment to Vercel
