# File Storage Migration Guide

## Overview

This project has been migrated from Dropbox storage to Vercel Blob Storage for better performance, scalability, and integration with the Vercel deployment platform.

## Vercel Blob Storage Configuration

### Environment Variables

Add these environment variables to your `.env.local` (development) and Vercel Dashboard (production):

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your-token-here
```

### Getting Your Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project
3. Go to **Settings** → **Environment Variables**
4. Create a new token in **Storage** → **Blob**
5. Copy the token and add it to your environment variables

## File Storage Structure

Files are organized using the following structure:

```
/orgs/{orgId}/
├── projects/{projectId}/
│   ├── rooms/{roomId}/
│   │   └── sections/{sectionId}/
│   │       └── {timestamp}-{filename}
│   └── {timestamp}-{filename}
├── users/{userId}/
│   ├── avatar/
│   │   └── {timestamp}-{filename}
│   ├── project-cover/
│   │   └── {timestamp}-{filename}
│   └── general/
│       └── {timestamp}-{filename}
└── general/
    └── {timestamp}-{filename}
```

## Usage in Code

### Basic File Upload

```typescript
import { uploadFile, generateFilePath } from '@/lib/blob'

// Upload a project file
const filePath = generateFilePath(
  orgId,
  projectId,
  roomId,
  sectionId,
  fileName
)

const result = await uploadFile(file, filePath, {
  contentType: 'image/jpeg',
  filename: fileName
})

console.log('File URL:', result.url)
```

### User Avatar Upload

```typescript
import { uploadFile, generateUserFilePath } from '@/lib/blob'

const filePath = generateUserFilePath(
  orgId,
  userId,
  fileName,
  'avatar'
)

const result = await uploadFile(buffer, filePath, {
  contentType: getContentType(fileName),
  filename: fileName
})
```

### Delete Files

```typescript
import { deleteFile } from '@/lib/blob'

await deleteFile(fileUrl)
```

### List Files

```typescript
import { listFiles } from '@/lib/blob'

const files = await listFiles(`orgs/${orgId}/projects/${projectId}/`)
```

## API Endpoints

### Upload Files

- `POST /api/upload` - General file upload for project assets
- `POST /api/upload-image` - Specialized image upload (avatars, project covers)

### File Management

- `GET /api/assets` - List organization assets
- `DELETE /api/assets/[assetId]` - Delete specific asset

## Migration Notes

### From Dropbox to Vercel Blob

1. **URLs**: File URLs have changed from Dropbox URLs to Vercel Blob URLs
2. **Structure**: New organized folder structure for better file management
3. **Performance**: Faster upload/download speeds with Vercel's CDN
4. **Integration**: Better integration with Next.js and Vercel platform

### Database Updates

The following database fields have been updated:

- `Project.coverImageUrl` - Now stores Vercel Blob URLs
- `Project.blobFolder` - Replaces `dropboxFolder`
- `Asset.provider` - Now uses "vercel-blob" instead of "dropbox"

## Fallback to Local Storage

If Vercel Blob is not configured, the system automatically falls back to local file storage:

```typescript
if (isBlobConfigured()) {
  // Use Vercel Blob
  result = await uploadFile(buffer, filePath, options)
} else {
  // Fall back to local storage
  result = await uploadFileLocally(buffer, fileName)
}
```

## Deployment Checklist

### Development Setup

1. Install Vercel Blob package: `npm install @vercel/blob`
2. Set `BLOB_READ_WRITE_TOKEN` in `.env.local`
3. Run database migrations: `npx prisma db push`

### Production Setup

1. Add `BLOB_READ_WRITE_TOKEN` to Vercel environment variables
2. Deploy with `vercel --prod`
3. Run database migrations: `npx prisma migrate deploy`

## Security Notes

- All uploaded files are stored with public access on Vercel Blob
- File paths include organization ID for data isolation
- Sensitive files should be served through API endpoints with proper authentication
- Regular token rotation is recommended for production environments

## Troubleshooting

### Upload Failures

1. Check if `BLOB_READ_WRITE_TOKEN` is set correctly
2. Verify token has read/write permissions
3. Check file size limits (Vercel Blob has generous limits)
4. Monitor Vercel function logs for detailed error messages

### File Access Issues

1. Ensure files are uploaded with `access: 'public'` for public access
2. Check if the blob URL is correctly formatted
3. Verify organization permissions for file access

### Performance Optimization

1. Use Vercel's CDN for file delivery
2. Implement client-side image compression before upload
3. Consider using `createUploadUrl` for direct client uploads of large files
4. Cache frequently accessed files