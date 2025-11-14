# Dropbox Folder Structure Update - 11 Folders ✅

## Summary

Successfully updated the Dropbox project folder structure from **10 folders to 11 folders**.

### Key Changes

1. **Folder 10 Renamed**: `10- SOFTWARE UPLOADS` → `10- REFERENCE MOOD`
2. **Folder 11 Added**: `11- SOFTWARE UPLOADS` (with 7 subfolders)
3. **All Asset Uploads Rerouted**: Now go to `11- SOFTWARE UPLOADS`

---

## Complete New Structure

```
/Meisner Interiors Team Folder/{Project Name}/
├── 1- CAD
├── 2- MAX
├── 3- RENDERING
├── 4- SENT
├── 5- RECIEVED
├── 6- SHOPPING
├── 7- SOURCES
├── 8- DRAWINGS
├── 9- SKP
├── 10- REFERENCE MOOD    ← RENAMED (was SOFTWARE UPLOADS)
└── 11- SOFTWARE UPLOADS  ← NEW
    ├── Project Covers
    ├── Spec Books
    │   ├── Generated
    │   └── Uploaded
    ├── Floorplan Approvals
    ├── Chat Attachments
    └── General Assets
```

---

## Files Modified ✅

### 1. `src/lib/dropbox-service.ts`
- Updated `createProjectFolderStructure()` to create 11 folders
- Added `10- REFERENCE MOOD` to folder list
- Changed `10- SOFTWARE UPLOADS` to `11- SOFTWARE UPLOADS`
- Automatically creates 7 subfolders inside `11- SOFTWARE UPLOADS`

### 2. `src/app/api/upload-image/route.ts`
- Project covers → `11- SOFTWARE UPLOADS/Project Covers`
- General images → `11- SOFTWARE UPLOADS/General Assets`

### 3. `src/app/api/spec-books/upload-pdf/route.ts`
- Uploaded PDFs → `11- SOFTWARE UPLOADS/Spec Books/Uploaded`

### 4. `src/app/api/upload/route.ts`
- General uploads → `11- SOFTWARE UPLOADS/General Assets`

### 5. `src/app/api/upload-pdf/route.ts`
- PDF uploads → `11- SOFTWARE UPLOADS/PDFs`

### 6. `src/app/api/chat/[stageId]/route.ts`
- Chat attachments → `11- SOFTWARE UPLOADS/Chat Attachments`

### 7. `src/lib/pdf-generation.ts` ✅ NEW
- Mirrors generated spec book PDFs to Dropbox
- Primary storage: Vercel Blob
- Archive copy: `11- SOFTWARE UPLOADS/Spec Books/Generated`
- Non-fatal: continues if Dropbox fails

### 8. `src/app/api/spec-books/generate/route.ts` ✅ NEW
- Passes project Dropbox folder to PDF generation service
- Returns Dropbox mirror URLs in response

### 9. `src/app/api/projects/[id]/floorplan-assets/route.ts` ✅ NEW
- Mirrors floorplan assets to Dropbox
- Primary storage: Database (base64)
- Archive copy: `11- SOFTWARE UPLOADS/Floorplan Approvals`
- Stores Dropbox URL/path in asset metadata
- Non-fatal: continues if Dropbox fails

### 10. `DROPBOX_FOLDERS_UPDATED.md`
- Updated documentation to reflect new structure

---

## Asset Routing Summary

| Asset Type | Destination |
|------------|-------------|
| **Project Covers** | `11- SOFTWARE UPLOADS/Project Covers` |
| **Spec Books (Generated)** | ✅ *Vercel Blob (primary)* + `11- SOFTWARE UPLOADS/Spec Books/Generated` |
| **Spec Books (Uploaded)** | `11- SOFTWARE UPLOADS/Spec Books/Uploaded` |
| **Floorplan Approvals** | ✅ *Database (primary)* + `11- SOFTWARE UPLOADS/Floorplan Approvals` |
| **Chat Attachments** | `11- SOFTWARE UPLOADS/Chat Attachments` |
| **General Uploads** | `11- SOFTWARE UPLOADS/General Assets` |

---

## What's Complete ✅

1. ✅ Folder structure updated to 11 folders
2. ✅ All `10- SOFTWARE UPLOADS` references changed to `11- SOFTWARE UPLOADS`
3. ✅ Project cover uploads routing correctly
4. ✅ Spec book uploaded PDF routing correctly
5. ✅ **Spec book generated PDFs mirroring to Dropbox**
6. ✅ **Floorplan approval assets mirroring to Dropbox**
7. ✅ General upload routing correctly
8. ✅ Chat attachment routing correctly
9. ✅ Documentation updated

---

## Next Steps (Optional Enhancements)

### Medium Priority
1. **Migration script for existing projects**
   - Create script to rename `10- SOFTWARE UPLOADS` → `10- REFERENCE MOOD`
   - Create `11- SOFTWARE UPLOADS` with subfolders in existing projects
   - Run once in production

### Low Priority
4. **Add constants for folder names**
   - Centralize folder names to prevent typos
   - Create reusable path building helpers

---

## Testing Checklist

### Manual Testing Required

- [ ] **Create a new project**
  - Verify all 11 folders are created in Dropbox
  - Confirm `10- REFERENCE MOOD` exists
  - Confirm `11- SOFTWARE UPLOADS` exists with subfolders

- [ ] **Upload project cover**
  - File should appear in `11- SOFTWARE UPLOADS/Project Covers`

- [ ] **Upload spec book PDF (manual)**
  - File should appear in `11- SOFTWARE UPLOADS/Spec Books/Uploaded`

- [ ] **Generate spec book PDF**
  - Primary PDF URL returned (Vercel Blob)
  - Mirror should appear in `11- SOFTWARE UPLOADS/Spec Books/Generated`
  - Response includes `dropboxUrl` and `dropboxPath`

- [ ] **Upload floorplan approval asset**
  - Asset stored in database
  - Mirror should appear in `11- SOFTWARE UPLOADS/Floorplan Approvals`
  - Asset metadata includes `dropboxUrl` and `dropboxPath`

- [ ] **Upload general file**
  - File should appear in `11- SOFTWARE UPLOADS/General Assets`

- [ ] **Send chat attachment**
  - File should appear in `11- SOFTWARE UPLOADS/Chat Attachments`

---

## Deployment Notes

### Environment Variables
- No new environment variables required
- Existing Dropbox credentials still valid

### Database Changes
- No database schema changes required

### Breaking Changes
- ⚠️ **Existing projects** will still have `10- SOFTWARE UPLOADS` folder
- New uploads will go to `11- SOFTWARE UPLOADS` (once created)
- Consider running migration script for consistency

---

## Folder Purpose Reference

| Folder | Purpose |
|--------|---------|
| 1- CAD | CAD files, DWG, DXF |
| 2- MAX | 3ds Max files |
| 3- RENDERING | Rendered images |
| 4- SENT | Files sent to client |
| 5- RECIEVED | Files received from client |
| 6- SHOPPING | Shopping lists, product info |
| 7- SOURCES | Source materials |
| 8- DRAWINGS | Architectural drawings |
| 9- SKP | SketchUp files |
| **10- REFERENCE MOOD** | **Reference images, mood boards** |
| **11- SOFTWARE UPLOADS** | **All ResidentOne software uploads** |

---

## Support

If you encounter any issues:
1. Check that Dropbox credentials are configured
2. Verify folder structure in Dropbox manually
3. Check console logs for upload errors
4. Ensure `dropboxFolder` is set on the project

---

**Status:** ✅ Complete and ready for testing
**Last Updated:** 2025-01-14
