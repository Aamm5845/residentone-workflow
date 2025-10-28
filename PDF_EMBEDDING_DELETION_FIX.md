# PDF Embedding and Deletion Fixes

## Issues Fixed

### 1. PDF Not Using Full Size
**Problem:** When PDFs were uploaded, they were being scaled down to fit within a content area instead of using their original full size.

**Solution:** 
- Removed all scaling calculations
- PDFs are now embedded at their original full size
- Updated both project-level sections and room CAD files

**Files Changed:**
- `src/lib/pdf-generation.ts` (lines 526-564, 836-860)

### 2. Multi-Page PDFs Only Showing First Page
**Problem:** When a PDF had multiple pages, only the first page was being embedded in the generated spec book.

**Solution:**
- Changed from copying only page `[0]` to copying ALL pages
- Uses `cadPdf.getPageCount()` to determine total pages
- Creates array of page indices: `Array.from({ length: pageCount }, (_, i) => i)`
- Loops through and adds each page individually

**Files Changed:**
- `src/lib/pdf-generation.ts` (lines 540-549, 833-841)

**Example:**
```typescript
// OLD - only first page
const cadPages = await pdfDoc.copyPages(cadPdf, [0])

// NEW - all pages
const pageCount = cadPdf.getPageCount()
const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
const cadPages = await pdfDoc.copyPages(cadPdf, pageIndices)
```

### 3. Deleted PDFs/Images Still Appearing in Generated Spec Book
**Problem:** After deleting a PDF or rendering image, it would still appear in newly generated spec books due to stale cached state.

**Solution:**

#### For PDFUpload Component:
- Added `useEffect` to fetch current files on mount and when `sectionId` changes
- Created `loadFiles()` function that queries the API for current state
- Updated `removeFile()` to reload files after deletion (instead of just filtering local state)
- Updated `onDrop()` to reload files after upload (instead of just appending to local state)

#### For RenderingUpload Component:
- Updated `handleRemoveRendering()` to pass the `imageUrl` along with `renderingId`
- This ensures the correct URL is removed from the `renderingUrls` array in the database

**Files Changed:**
- `src/components/spec-book/PDFUpload.tsx` (added useEffect, loadFiles function, updated removeFile and onDrop)
- `src/components/spec-book/RenderingUpload.tsx` (updated handleRemoveRendering to pass imageUrl)

## Technical Details

### PDF Embedding Flow (Before)
1. Fetch PDF from URL
2. Load PDF document
3. Copy ONLY first page (index 0)
4. Calculate scale to fit within content area
5. Apply scaling and positioning transformations
6. Add to document

### PDF Embedding Flow (After)
1. Fetch PDF from URL
2. Load PDF document
3. Get total page count
4. Create array of ALL page indices
5. Copy ALL pages
6. Add each page at FULL SIZE (no scaling)
7. Remove placeholder page if files were embedded

### Deletion Flow (Before)
1. User clicks delete
2. Call DELETE API
3. Filter local state (but state might be stale)
4. PDF generation still uses cached/stale data

### Deletion Flow (After)
1. User clicks delete
2. Call DELETE API with proper identifiers (including imageUrl for renderings)
3. Reload fresh data from API
4. PDF generation uses current database state (filtered by `isActive: true`)

## Database Filtering

The PDF generation already had proper filtering:
- Project sections: Query includes `where: { isActive: true }` on dropboxFiles
- Room sections: Query includes `where: { isActive: true }` on dropboxFiles

This means soft-deleted files (with `isActive: false`) are automatically excluded from generation.

## Testing Checklist

- [ ] Upload a single-page PDF → Verify full size in generated spec book
- [ ] Upload a multi-page PDF → Verify ALL pages appear in generated spec book
- [ ] Upload multiple rendering images to a room → Verify all appear in spec book
- [ ] Delete a PDF → Verify it doesn't appear in newly generated spec book
- [ ] Delete a rendering image → Verify it doesn't appear in newly generated spec book
- [ ] Upload, then immediately generate → Verify new files appear
- [ ] Delete, then immediately generate → Verify deleted files don't appear

## Build Status
✅ Build passed successfully (exit code 0)
✅ 143 static pages generated
✅ No TypeScript errors in modified files
