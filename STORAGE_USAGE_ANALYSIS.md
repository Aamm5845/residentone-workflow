# Storage Usage Analysis - Blob vs Dropbox

## Currently Using Vercel Blob Storage 🔵

### 1. **Project Cover Images** 
- **File**: `src/app/api/upload-image/route.ts`
- **Usage**: Project cover photos
- **Path**: `orgs/{orgId}/users/{userId}/project-cover/`
- **Status**: ❌ Should move to Dropbox

### 2. **User Avatars**
- **File**: `src/app/api/upload-image/route.ts`
- **Usage**: Team member profile pictures
- **Path**: `orgs/{orgId}/users/{userId}/avatar/`
- **Status**: ❌ Should move to Dropbox

### 3. **Spec Book PDF Uploads**
- **File**: `src/app/api/spec-books/upload-pdf/route.ts`
- **Usage**: Manual PDF uploads for spec books
- **Path**: Various
- **Status**: ❌ Should move to Dropbox

### 4. **General PDF Uploads**
- **File**: `src/app/api/upload-pdf/route.ts`
- **Usage**: General document uploads
- **Path**: Various
- **Status**: ❌ Should move to Dropbox

### 5. **Chat Image Attachments**
- **File**: `src/app/api/chat/[stageId]/route.ts`
- **Usage**: Images attached to chat messages
- **Path**: `orgs/{orgId}/projects/{projectId}/`
- **Status**: ❌ Should move to Dropbox

### 6. **Stage Asset Uploads** (Generic)
- **File**: `src/app/api/upload/route.ts`
- **Usage**: Various stage-related uploads
- **Path**: `orgs/{orgId}/projects/{projectId}/rooms/{roomId}/`
- **Status**: ❌ Should move to Dropbox

## Currently Using Dropbox ✅

### 1. **Design Concept Uploads** ✓
- **File**: `src/app/api/design/upload/route.ts`
- **Folder**: `7- SOURCES/Design Concept`
- **Status**: ✅ Already on Dropbox

### 2. **3D Rendering Uploads** ✓
- **File**: `src/app/api/renderings/[versionId]/upload/route.ts`
- **Folder**: `3- RENDERING`
- **Status**: ✅ Already on Dropbox

### 3. **Drawing/CAD Files** ✓
- **File**: `src/app/api/drawings/[stageId]/upload/route.ts`
- **Folder**: `1- CAD` (inferred)
- **Status**: ✅ Already on Dropbox

### 4. **CAD Conversion Results** ✓
- **File**: `src/lib/cad-conversion-enhanced.ts`
- **Folder**: Various
- **Status**: ✅ Already on Dropbox

### 5. **Spec Book Generation** ✓
- **File**: `src/app/api/spec-books/generate/route.ts`
- **Folder**: `8- SPEC BOOK`
- **Status**: ✅ Already on Dropbox

### 6. **Database Backups** ✓
- **File**: `src/app/api/cron/daily-backup/route.ts`
- **Folder**: `/Meisner Interiors Team Folder/Software Backups/`
- **Status**: ✅ Already on Dropbox

## Recommended Changes

### Move to Dropbox: `10- SOFTWARE UPLOADS`

All Blob Storage uploads should be migrated to Dropbox under:
```
/Meisner Interiors Team Folder/[Project Folder]/10- SOFTWARE UPLOADS/
```

With subfolders:
```
10- SOFTWARE UPLOADS/
├── Project Covers/
├── User Avatars/
├── Chat Attachments/
├── PDFs/
└── General Assets/
```

## Implementation Plan

### Phase 1: Update Upload Endpoints ✏️

1. **Project Cover Images**
   - Update `/api/upload-image` route
   - Target folder: `10- SOFTWARE UPLOADS/Project Covers/`

2. **User Avatars**
   - Update `/api/upload-image` route  
   - Target folder: `10- SOFTWARE UPLOADS/User Avatars/`

3. **Chat Attachments**
   - Update `/api/chat/[stageId]` route
   - Target folder: `10- SOFTWARE UPLOADS/Chat Attachments/`

4. **PDF Uploads**
   - Update `/api/upload-pdf` route
   - Target folder: `10- SOFTWARE UPLOADS/PDFs/`

5. **General Stage Assets**
   - Update `/api/upload` route
   - Target folder: `10- SOFTWARE UPLOADS/General Assets/`

### Phase 2: Migrate Existing Blob Files 📦

1. List all files in Vercel Blob
2. Download each file
3. Upload to appropriate Dropbox folder
4. Update database URLs from blob URLs to Dropbox URLs
5. Verify all links work
6. Delete from Blob Storage

### Phase 3: Remove Blob Dependencies 🗑️

1. Remove `@vercel/blob` package
2. Remove `BLOB_READ_WRITE_TOKEN` from environment variables
3. Update all references to use Dropbox only
4. Test all upload functionality

## Benefits

✅ **Single Source of Truth**: All files in one place (Dropbox)  
✅ **Better Organization**: Team folder structure with numbered folders  
✅ **Cost Savings**: No Vercel Blob Storage costs  
✅ **Team Access**: Team members can access files directly via Dropbox  
✅ **Backup**: Files are backed up with Dropbox's infrastructure  
✅ **Consistency**: Same storage system for all file types  

## Current Blob Usage (from backup)

From your November 4th backup, here are the 10 files in Blob Storage:
1. Images in `/orgs/cmg02icv200003kfkqs2jizja/projects/.../rooms/.../`
   - 3D rendering images (10 files)
   - All in project rooms

These should be migrated to:
```
[Project Dropbox Folder]/10- SOFTWARE UPLOADS/Rendering Images/
```
