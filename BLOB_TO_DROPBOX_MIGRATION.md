# Blob to Dropbox Migration Progress

## Goal
Move all Vercel Blob Storage uploads to Dropbox under the `10- SOFTWARE UPLOADS` folder structure.

## ✅ Completed

### 1. Project Cover Images & User Avatars
- **File Modified**: `src/app/api/upload-image/route.ts`
- **Status**: ✅ Complete
- **Changes**:
  - Removed Vercel Blob imports
  - Added Dropbox Service
  - Now uploads to:
    - Project Covers → `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/Project Covers/`
    - User Avatars → `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/User Avatars/`
    - General Assets → `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/General Assets/`
  - Uses Dropbox temporary links for immediate access

## 🔄 In Progress

### 2. Chat Image Attachments
- **File**: `src/app/api/chat/[stageId]/route.ts`
- **Target**: `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/Chat Attachments/`
- **Status**: ⏳ Pending

### 3. PDF Uploads
- **File**: `src/app/api/upload-pdf/route.ts`
- **Target**: `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/PDFs/`
- **Status**: ⏳ Pending

### 4. Generic Stage Uploads
- **File**: `src/app/api/upload/route.ts`
- **Target**: `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/General Assets/`
- **Status**: ⏳ Pending

### 5. Spec Book PDF Uploads
- **File**: `src/app/api/spec-books/upload-pdf/route.ts`
- **Target**: `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/Spec Books/`
- **Status**: ⏳ Pending

## Already Using Dropbox ✓

These uploads are already correctly using Dropbox:
- ✅ Design Concept Uploads → `7- SOURCES/Design Concept`
- ✅ 3D Rendering Uploads → `3- RENDERING`
- ✅ Drawing/CAD Files → `1- CAD`
- ✅ Spec Book Generation → `8- SPEC BOOK`
- ✅ Database Backups → `/Software Backups/`

## Folder Structure

```
/Meisner Interiors Team Folder/
├── [Project Folder]/
│   ├── 1- CAD/
│   ├── 2- MAX/
│   ├── 3- RENDERING/
│   ├── 4- SENT/
│   ├── 5- RECIEVED/
│   ├── 6- SHOPPING/
│   ├── 7- SOURCES/
│   ├── 8- DRAWINGS/
│   ├── 9- SKP/
│   └── 10- SOFTWARE UPLOADS/     ← NEW!
│       ├── Project Covers/
│       ├── User Avatars/
│       ├── Chat Attachments/
│       ├── PDFs/
│       ├── Spec Books/
│       └── General Assets/
```

## Testing

After each migration:
1. Upload a test file
2. Verify it appears in correct Dropbox folder
3. Verify the file displays correctly in the app
4. Check temporary link generation works

## Benefits

✅ **Unified Storage**: All files in Dropbox  
✅ **Cost Savings**: No Vercel Blob costs  
✅ **Team Access**: Direct Dropbox file access  
✅ **Better Organization**: Numbered folder structure  
✅ **Consistency**: Same storage for all file types  

## Next Steps

1. Complete remaining endpoint migrations
2. Test all upload types
3. Migrate existing Blob files to Dropbox
4. Update database URLs
5. Remove Blob dependencies
6. Remove `@vercel/blob` package
7. Clean up environment variables

## Notes

- Dropbox temporary links expire after 4 hours
- For permanent display, we may need to implement a link refresh mechanism
- Consider storing both Dropbox path AND temporary link in database
- Implement background job to refresh expired links
