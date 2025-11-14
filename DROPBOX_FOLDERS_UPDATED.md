# Dropbox Project Folders Updated ✅

## Changes Made

Updated the Dropbox project folder structure from **10 folders to 11 folders**.

### Files Modified:
- `src/lib/dropbox-service.ts`
- `src/app/api/upload-image/route.ts`
- `src/app/api/spec-books/upload-pdf/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/upload-pdf/route.ts`
- `src/app/api/chat/[stageId]/route.ts`

### Changes:
1. **10- SOFTWARE UPLOADS** → **10- REFERENCE MOOD**
2. **Added 11- SOFTWARE UPLOADS** (new folder for all software-generated assets)

---

## Complete Folder Structure

When creating a new project or configuring Dropbox integration, the following folders will now be created:

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
├── 10- REFERENCE MOOD    ← UPDATED (was SOFTWARE UPLOADS)
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

## Where This Applies

### 1. **New Project Creation**
When creating a new project with Dropbox integration enabled:
- Location: `/projects/new`
- Option: "Create new Dropbox folder"
- All 10 folders will be created automatically

### 2. **Project Settings**
When enabling Dropbox integration in existing project settings:
- Location: `/projects/[id]/settings`
- Section: "Dropbox Integration"
- Option: "Create Dropbox folder structure"
- All 10 folders will be created

---

## Testing

### To Test the Changes:

1. **Create a New Project:**
   ```
   1. Go to /projects
   2. Click "New Project"
   3. Fill in project details
   4. Select "Create new Dropbox folder"
   5. Submit
   ```

2. **Check Dropbox:**
   - Open Dropbox → Meisner Interiors Team Folder
   - Find your project folder
   - Verify all 10 subfolders exist

3. **Or in Existing Project:**
   ```
   1. Go to project settings
   2. Find "Dropbox Integration" section
   3. Click "Create Folder Structure"
   4. Check Dropbox for 10 folders
   ```

---

## Usage Examples

### DRAWINGS Folder (8-)
- Purpose: Store architectural drawings, plans, elevations
- Typical files: PDF drawings, DWG exports, construction documents

### SKP Folder (9-)
- Purpose: SketchUp files (.skp)
- Typical files: 3D models, design iterations, component files

### REFERENCE MOOD Folder (10-)
- Purpose: Reference images, mood boards, inspiration materials
- Typical files: Images, PDFs, design references

### SOFTWARE UPLOADS Folder (11-)
- Purpose: All software-generated files and uploads from ResidentOne
- Subfolders:
  - **Project Covers**: Project cover images
  - **Spec Books/Generated**: Auto-generated spec book PDFs
  - **Spec Books/Uploaded**: User-uploaded spec book PDFs
  - **Floorplan Approvals**: Floorplan approval assets
  - **Chat Attachments**: Images shared in project chat
  - **General Assets**: General uploads

---

## Code Details

### Function Updated:
```typescript
async createProjectFolderStructure(projectName: string): Promise<string>
```

**Location:** `src/lib/dropbox-service.ts` (lines 561-613)

### Implementation:
- Creates main project folder
- Iterates through 10 subfolders
- Error handling: Continues if individual folder creation fails
- Returns: Main folder path

---

## Backwards Compatibility

✅ **Existing projects are NOT affected**
- Projects created before this update keep their existing folder structure (7 folders)
- Only NEW projects or projects that run "Create Folder Structure" again will get 10 folders
- No breaking changes

---

## Next Steps

### To Apply Changes:

1. **Restart Dev Server** (if running):
   ```bash
   # Press Ctrl+C
   npm run dev
   ```

2. **Test Creating a Project:**
   - Create a new project with Dropbox enabled
   - Verify 10 folders appear in Dropbox

3. **Commit Changes:**
   ```bash
   git add src/lib/dropbox-service.ts
   git commit -m "Add 3 new folders to Dropbox project structure: DRAWINGS, SKP, SOFTWARE UPLOADS"
   git push origin main
   ```

---

## Summary

| Item | Before | After |
|------|--------|-------|
| Total Folders | 10 | **11** ✅ |
| 10- SOFTWARE UPLOADS | ✅ | Renamed to **10- REFERENCE MOOD** |
| 11- SOFTWARE UPLOADS | ❌ | **NEW** ✅ |
| Subfolders in 11- | ❌ | 7 subfolders created ✅ |
| Asset Upload Routing | Mixed | All to 11- SOFTWARE UPLOADS ✅ |
| Files Modified | 1 | 6 files |

**Status:** Ready to test! 🚀
