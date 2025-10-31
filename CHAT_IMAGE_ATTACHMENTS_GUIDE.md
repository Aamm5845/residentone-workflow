# Chat Image Attachments Feature

## Overview
Added image attachment capability to the phase chat system. Users can now attach images to chat messages, see previews, and download them.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
Added two new fields to the `ChatMessage` model:
- `imageUrl`: Stores the URL of the uploaded image
- `imageFileName`: Stores the original filename

### 2. Backend API (`src/app/api/chat/[stageId]/route.ts`)
Updated the POST endpoint to:
- Accept both JSON (text-only) and FormData (with image) requests
- Validate image type (JPEG, PNG, WebP, GIF) and size (max 5MB)
- Upload images to Vercel Blob storage
- Store image metadata in the database

### 3. Frontend Component (`src/components/chat/PhaseChat.tsx`)
Enhanced the chat interface with:
- **Attach button**: Paperclip icon to select images
- **Image preview**: Shows thumbnail before sending
- **Remove button**: X button to cancel image attachment
- **Message display**: Shows attached images with preview
- **Download button**: Appears on hover to download images
- **Click to enlarge**: Click images to open in new tab

## Features

### For Users
1. **Attach Images**: Click the paperclip icon next to the message input
2. **Preview**: See a preview of the selected image before sending
3. **Send**: Images are uploaded along with text (text is optional)
4. **View**: Attached images appear in messages with full preview
5. **Download**: Hover over images to see download button
6. **Enlarge**: Click images to open full size in new tab

### Validation
- **File types**: JPEG, PNG, WebP, GIF only
- **File size**: Maximum 5MB per image
- **Single image**: One image per message

### Storage
- Images are stored in Vercel Blob storage
- Organized by: `orgId/chat/stageId/filename`
- Falls back gracefully if Blob storage is not configured

## Migration Steps

### 1. Update Database
Run the Prisma migration to add new fields:

```bash
npx prisma migrate dev --name add_chat_image_attachments
```

Or if you prefer to push changes without migration:

```bash
npx prisma db push
```

### 2. Verify Blob Storage
Ensure Vercel Blob is configured in your environment:

```bash
# Check if BLOB_READ_WRITE_TOKEN is set
echo $BLOB_READ_WRITE_TOKEN
```

If not configured, images won't upload (feature requires blob storage).

### 3. Test the Feature
1. Navigate to any phase with chat
2. Click the paperclip icon
3. Select an image (JPEG, PNG, WebP, or GIF)
4. See the preview appear
5. Add optional text message
6. Click Send
7. Verify image appears in chat
8. Hover to see download button
9. Click image to view full size

## Technical Details

### Image Upload Flow
1. User selects image → Client validates type/size
2. Image preview generated using FileReader API
3. On send → FormData created with content, mentions, and image
4. Server receives multipart/form-data
5. Server validates and uploads to Blob storage
6. Message created with imageUrl and imageFileName
7. Client updates UI with new message

### Database Schema
```prisma
model ChatMessage {
  id            String        @id @default(cuid())
  content       String
  imageUrl      String?       // New field
  imageFileName String?       // New field
  // ... other fields
}
```

### API Request (with image)
```typescript
// FormData structure
{
  content: string,        // Message text (optional if image present)
  mentions: string,       // JSON array of user IDs
  image: File            // Image file
}
```

### API Response
```typescript
{
  success: true,
  message: {
    id: string,
    content: string,
    imageUrl: string | null,
    imageFileName: string | null,
    author: { id, name, role, image },
    mentions: [...],
    createdAt: string,
    // ... other fields
  }
}
```

## UI/UX Enhancements

### Attachment Button
- Located next to the message input
- Paperclip icon for intuitive recognition
- Disabled while sending or when image already selected

### Image Preview (Before Sending)
- Thumbnail shown above input field
- Max dimensions: 384px wide, 128px tall
- Remove button (X) in top-right corner
- Rounded borders with shadow

### Image Display (In Messages)
- Max dimensions: 512px wide, 256px tall
- Rounded corners with border
- Hover effect (slight opacity change)
- Download button appears on hover
- Click to open full size in new tab

### Download Button
- Hidden by default, appears on hover
- White background with shadow
- Top-right corner of image
- Direct download link

## Error Handling

The system handles these error cases:
- Invalid file type → Toast error message
- File too large → Toast error message  
- Upload failure → Toast error with specific message
- Network errors → Generic error message
- Blob storage not configured → Server returns 500 error

## Future Enhancements (Optional)

Consider adding:
- Multiple images per message
- Image compression before upload
- Drag-and-drop support
- Copy/paste images from clipboard
- Image editing tools (crop, rotate)
- Video attachments
- File attachments (PDFs, documents)
- Image galleries for multiple attachments
- Lazy loading for images
- Image caching

## Security Considerations

✅ **Implemented:**
- File type validation (client and server)
- File size limits (5MB)
- Authenticated uploads only
- Org-scoped storage paths
- Secure URLs from Vercel Blob

⚠️ **Consider adding:**
- Virus scanning for uploaded files
- Rate limiting on uploads
- Image content moderation
- Watermarking for sensitive projects
- Auto-deletion of old attachments

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify Blob storage is configured
3. Check file type and size requirements
4. Ensure database migration was applied
5. Review server logs for upload errors

## Rollback

To remove this feature:
1. Revert the schema changes
2. Run migration to remove fields
3. Revert component changes
4. Remove blob storage integration
