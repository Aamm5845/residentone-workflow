# Storage Migration & Error Analysis Report
Generated: 2025-11-05

## Executive Summary
Your codebase is in a **transition state** between Blob Storage and Dropbox. There's also a **major database schema mismatch** between local and remote git.

---

## Critical Issues Found

### 1. DATABASE SCHEMA MISMATCH (CRITICAL)
**Status:** Your local schema has MANY more models than the remote git version

**Problem:**
- **Local HEAD** is **1 commit ahead** of origin/main
- The schema diff shows your LOCAL has the full application schema with 100+ models
- The REMOTE (origin/main) has been stripped down to only basic auth models
- This explains why "my local folder doesn't show any project" - the remote schema doesn't support projects!

**Models Present Locally but Missing from Remote:**
- Activity, ActivityLog, Approval, Asset, AssetPin, AssetTag
- CadLayoutCache, CadPreferences, ChatMention, ChatMessage
- Client, Comment, Contractor, DesignSection
- DrawingChecklistItem, DropboxFileLink
- EmailLog, FFE* (all FFE-related models)
- Project, Room, Stage, SpecBook
- And 70+ more models...

**Remote Only Has:**
- Account, Session, VerificationToken, PasswordResetToken
- Basic User model

**Action Required:**
1. **DO NOT PUSH** your local schema to remote until you understand what happened
2. Verify which version is correct (likely your local version)
3. Check if someone accidentally pushed a schema rollback
4. Consider using `git reflog` to find when the remote schema was changed

---

### 2. STORAGE MIGRATION STATUS

#### Where Blob Storage is STILL Used:
**Files using @vercel/blob:**
1. **`src/lib/blob.ts`** - Core blob utilities (uploadFile, deleteFile, listFiles)
2. **`src/lib/pdf-generation.ts`** - PDF uploads to blob
3. **`src/lib/cad-conversion.ts`** - CAD file conversions to blob
4. **`src/lib/cad-conversion-enhanced.ts`** - Enhanced CAD conversions to blob
5. **`src/app/api/upload/route.ts`** - General upload endpoint using blob
6. **`src/app/api/upload-pdf/route.ts`** - PDF upload endpoint
7. **`src/app/api/drawings/[stageId]/upload/route.ts`** - Drawing uploads to blob

**Configuration:**
- Environment variable: `BLOB_READ_WRITE_TOKEN`
- Package: `@vercel/blob` (installed in package.json)

#### Where Dropbox is Used:

**Core Dropbox Services:**
1. **`src/lib/dropbox-service.ts`** - Main Dropbox service (team folders, file operations)
2. **`src/lib/dropbox-service-v2.ts`** - Alternative Dropbox implementation
3. **`src/lib/dropbox-utils.ts`** - Helper utilities

**Dropbox is Used For:**
1. **Project Cover Images** (`src/app/api/upload-image/route.ts`)
   - Path: `{projectFolder}/Project-Images/`
   - Stored in database Asset table with provider='dropbox'

2. **CAD Files & Layouts** 
   - `src/app/api/cad/layouts/route.ts`
   - `src/app/api/cad-conversion/route.ts`
   - `src/app/api/cad/convert/route.ts`
   - Cached in `CadLayoutCache` table with dropboxPath/dropboxRevision

3. **Drawing Workspace Files**
   - `src/app/api/drawings/checklist/[checklistItemId]/link-files/route.ts`
   - `src/hooks/useDrawingsWorkspace.ts`
   - Stored in `DropboxFileLink` table

4. **Spec Book Files**
   - `src/app/api/spec-books/link-files/route.ts`
   - `src/app/api/spec-books/upload-pdf/route.ts`
   - `src/components/spec-book/DropboxFileBrowser.tsx`

5. **Rendering Assets**
   - `src/app/api/renderings/[versionId]/upload/route.ts`
   - `src/components/stages/RenderingWorkspace.tsx`

6. **Client Approval Assets**
   - `src/app/api/client-approval/[stageId]/route.ts`

7. **Project Folder Management**
   - `src/app/api/projects/route.ts` - Creates Dropbox folders on project creation
   - `src/app/api/projects/[id]/dropbox-folder/route.ts`
   - `src/components/projects/DropboxFolderBrowser.tsx`

**Dropbox Configuration:**
- `DROPBOX_ACCESS_TOKEN` or `DROPBOX_REFRESH_TOKEN`
- `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
- `DROPBOX_TEAM_MEMBER_ID` / `DROPBOX_API_SELECT_USER`
- `DROPBOX_ROOT_NAMESPACE_ID` (default: 11510809107)
- Team Folder: "Meisner Interiors Team Folder"

**Database Fields Using Dropbox:**
```prisma
Project.dropboxFolder         String?
Asset.provider                String?  // "dropbox"
Asset.url                     String   // Dropbox path
CadLayoutCache.dropboxPath    String
CadLayoutCache.dropboxRevision String
DropboxFileLink.dropboxPath   String
DropboxFileLink.dropboxFileId String?
DropboxFileLink.dropboxRevision String?
```

---

## Storage Usage Pattern

### Current Architecture:
```
┌─────────────────────────────────────────────┐
│         Asset Type Routing                   │
├─────────────────────────────────────────────┤
│                                              │
│  Project Cover Images  ────→  Dropbox       │
│  CAD Files            ────→  Dropbox        │
│  Drawing Files        ────→  Dropbox        │
│  Spec Book PDFs       ────→  Dropbox        │
│  Rendering Images     ────→  Dropbox        │
│  Client Approvals     ────→  Dropbox        │
│                                              │
│  General Uploads      ────→  Blob Storage   │
│  PDF Generation       ────→  Blob Storage   │
│  User Avatars         ────→  Local Storage  │
│  (fallback)           ────→  Local Storage  │
└─────────────────────────────────────────────┘
```

### Migration Status:
**✅ Migrated to Dropbox:**
- Project-specific assets
- CAD drawings and conversions
- Spec book files
- Client approval images
- Rendering uploads

**❌ Still on Blob Storage:**
- General file uploads
- PDF generation outputs
- Legacy uploads via `/api/upload` endpoint

**⚠️ Mixed/Local:**
- Avatar images (local storage)
- Some general images (local storage)

---

## Database Fields for Asset Tracking

### Asset Model:
```prisma
Asset {
  id                     String
  url                    String         // Full path (Dropbox path or Blob URL)
  provider               String?        // "dropbox", "vercel-blob", or null
  filename               String?
  type                   AssetType      // IMAGE, DOCUMENT, etc.
  metadata               String?        // JSON with storage details
  projectId              String?
  roomId                 String?
  stageId                String?
  renderingVersionId     String?
}
```

### Dropbox-Specific Tables:
```prisma
DropboxFileLink {
  dropboxPath            String
  dropboxFileId          String?
  dropboxRevision        String?
  cadToPdfCacheUrl       String?
  uploadedPdfUrl         String?
}

CadLayoutCache {
  dropboxPath            String
  dropboxRevision        String
  layouts                Json
}
```

---

## Recommendations

### Immediate Actions:
1. **Fix Database Schema Issue**
   - Investigate what happened to remote schema
   - Backup your local database
   - Determine correct version
   - Push correct schema to remote

2. **Document Storage Strategy**
   - Decide: Full Dropbox migration or keep hybrid?
   - Update `docs/storage.md` (currently documents Blob migration that partially happened)

3. **Audit Missing Files**
   - Run: `git status` to see untracked files
   - Check what's in git vs local
   - Add necessary files to git

### Long-term Actions:
1. **Complete Migration** (if desired)
   - Migrate remaining blob uploads to Dropbox
   - Update `/api/upload` to use Dropbox
   - Remove `@vercel/blob` dependency

2. **Or Clarify Hybrid Model**
   - Document which assets go where
   - Update all API documentation
   - Add storage provider field to all upload responses

3. **Fix Local Project Display**
   - Sync database schema
   - Run migrations: `npx prisma db push`
   - Verify projects exist in database

---

## Files Changed (Not Committed)
```
Modified:
- restore-complete.js
- src/app/api/upload-image/route.ts
- src/app/projects/page.tsx
- src/components/projects/interactive-projects-page.tsx
- src/components/projects/project-settings-form.tsx

Untracked (potential recovery scripts):
- analyze-backup.js
- check-all.js
- check-assets.js
- check-project-covers.js
- fix-assets.js
- restore-final.js
- restore-now.js
- restore-smart.js
- scripts/restore-cover-images.js
- verify-login.js
```

---

## Testing Commands

```bash
# Check database connection
npm run prisma studio

# Verify schema sync
npx prisma db push

# List projects in database
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.project.findMany().then(console.log)"

# Check Dropbox connection
# Visit: /api/debug/test-dropbox

# Check Blob storage
# Visit: /api/debug/blob-test (if exists)
```

---

## Environment Variables Required

### Dropbox (Currently Active):
```bash
DROPBOX_ACCESS_TOKEN=xxx
# OR
DROPBOX_REFRESH_TOKEN=xxx
DROPBOX_APP_KEY=xxx
DROPBOX_APP_SECRET=xxx

DROPBOX_TEAM_MEMBER_ID=xxx
DROPBOX_ROOT_NAMESPACE_ID=11510809107
```

### Blob Storage (Partially Active):
```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

---

## Next Steps

1. **Resolve schema issue** - Most critical
2. **Run database sync** - `npx prisma db push`
3. **Verify projects appear** in UI
4. **Decide on storage strategy** - Document it
5. **Complete migration or clarify hybrid model**
6. **Update all documentation** to reflect current reality

---

## Contact Points for Issues

- Schema issues: Check `prisma/schema.prisma` line-by-line diff
- Upload failures: Check logs in respective API routes
- Missing projects: Query database directly with Prisma Studio
- Dropbox errors: Check API routes under `/api/dropbox/`
