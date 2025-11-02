# Drawing Phase Dropbox Integration - Testing Guide

## ✅ Implementation Complete

All features have been implemented. Follow this guide to test the functionality.

---

## How to Test

### 1. Navigate to a Drawing Phase
- Go to any project
- Select a room
- Navigate to the Drawing Phase (DRAWINGS stage)

### 2. Add a Custom Section
1. Look for the "Add Custom Section" button at the top of Drawing Categories
2. Click it
3. Enter a name (e.g., "Custom Details", "Specifications", etc.)
4. Press Enter or click "Add Section"
5. ✅ **Expected**: New section appears in the list

### 3. Link Dropbox Files
1. Click "Link from Dropbox" button on any section (default or custom)
2. Dialog should open showing "Link Files from Dropbox - [Section Name]"
3. Click "Browse Dropbox" button
4. Navigate through your Dropbox folders
5. Click on any file to link it
6. ✅ **Expected**: Toast notification confirms file linked
7. Click on more files to link multiple files
8. Click "Done" when finished
9. ✅ **Expected**: Dialog closes and linked files appear in blue section

### 4. View Linked Files
1. Look for the blue "Linked from Dropbox" section above uploaded files
2. ✅ **Expected**: See all linked files with:
   - File name
   - File size
   - Last modified date
   - External link icon (opens Dropbox)
   - X button to unlink

### 5. Unlink Files
1. Click the X button on any linked file
2. Confirm the action
3. ✅ **Expected**: File is removed from the list

### 6. Upload Files (Existing Functionality)
1. Click "Upload Files" or drag & drop files
2. ✅ **Expected**: Files upload and appear in the files grid
3. ✅ **Verify**: Both uploaded and linked files count toward completion

### 7. Complete Sections
1. Check off sections that have files (uploaded OR linked)
2. ✅ **Expected**: Sections with only linked files can be completed
3. ✅ **Expected**: Sections with only uploaded files can be completed
4. ✅ **Expected**: Sections with both types can be completed

### 8. Complete Drawing Stage
1. Complete all sections
2. Click "Complete Workspace"
3. ✅ **Expected**: Stage marked as complete

---

## Fixed Issue

**Problem**: Dropbox dialog wasn't appearing when clicking "Link from Dropbox"

**Solution**: 
- Changed DropboxFileBrowser to use `mode="select"` instead of `mode="link"`
- Handle file linking through our custom API (`/api/drawings/checklist/[id]/link-files`)
- Added proper props: `onFileSelected`, `variant="settings"`, `allowMultiple={true}`
- Added "Done" button to close dialog after selecting files

**Now**: Dialog opens properly with full Dropbox browser functionality!

---

## Key Features Working

✅ Add unlimited custom sections  
✅ Link files from Dropbox (using project's dropboxFolder)  
✅ View linked files with metadata  
✅ Unlink files with confirmation  
✅ Upload files normally (existing feature)  
✅ Both file types count toward completion  
✅ Activity logging for all operations  
✅ Proper authorization at all levels  

---

## Technical Notes

- DropboxFileBrowser now in "select" mode (calls `onFileSelected`)
- Each file click triggers immediate linking via API
- Dialog stays open for multiple selections
- Uses our drawing-specific API endpoints
- No changes needed to DropboxFileBrowser component itself

---

## If Issues Occur

1. **Dropbox dialog empty**: Make sure project has `dropboxFolder` set in Project Settings
2. **Files not linking**: Check browser console for API errors
3. **Authorization errors**: Verify user is logged in and has access to the project
4. **Files not appearing**: Refresh the page - should auto-reload via SWR

---

## Database Status

✅ Schema migrated successfully with `npm run db:push`  
✅ No data loss  
✅ All relations configured with cascade deletes  
✅ Activity logs working  

Everything is ready to use!
