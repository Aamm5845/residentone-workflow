# Fix: Multiple Room Rendering Images in Spec Book PDF

## Problem
When uploading 2 pictures for a room in the spec book, the PDF generation only showed one image. This was because:
- The database schema only supported a single `renderingUrl` field
- Each upload would overwrite the previous URL
- The PDF generation only read the single `renderingUrl` field

## Solution
Added support for multiple rendering images per room by:
1. Adding a `renderingUrls` array field to the database schema
2. Updating all APIs to append to the array instead of overwriting
3. Updating PDF generation to render all images (each on its own page)

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Added `renderingUrls String[] @default([])` field to `SpecBookSection` model
- Keeps legacy `renderingUrl` field for backward compatibility

### 2. Upload API (`src/app/api/upload-image/route.ts`)
- Now appends new rendering URLs to the `renderingUrls` array
- Maintains backward compatibility by also setting `renderingUrl` to the latest image

### 3. Room Renderings API (`src/app/api/spec-books/room-renderings/route.ts`)
- **GET**: Returns all rendering URLs from the array
- **POST**: Appends to the `renderingUrls` array instead of overwriting
- **DELETE**: Removes specific URL from array while maintaining others

### 4. PDF Generation (`src/lib/pdf-generation.ts`)
- Updated to support multiple rendering URLs per room
- Creates a separate page for each rendering image
- Maintains the same minimalist header style for each page

### 5. Generate Route (`src/app/api/spec-books/generate/route.ts`)
- Passes `renderingUrls` array to PDF generation service
- Maintains backward compatibility with single `renderingUrl`

## Migration
A database migration was created and applied:
- **Migration**: `20251028000000_add_rendering_urls_array`
- Adds the `renderingUrls` column to `SpecBookSection` table
- Migrates existing single `renderingUrl` values to the new array format

## Testing
To test the fix:
1. Go to a room in the spec book builder
2. Upload 2 or more rendering images
3. Generate the PDF
4. Verify that all uploaded images appear in the PDF (each on its own page)

## Backward Compatibility
- Legacy single `renderingUrl` field is maintained
- Old data is automatically migrated to the new array format
- Code supports both old (single URL) and new (array) formats

## Next Steps
After deploying, you should:
1. Test uploading multiple images to a room
2. Generate a PDF and verify all images appear
3. Test deleting individual images from a room
4. Verify existing rooms with single images still work correctly
