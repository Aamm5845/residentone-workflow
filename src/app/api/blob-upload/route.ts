import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getSession } from '@/auth'

/**
 * Client-side upload handler for Vercel Blob
 * This bypasses the 4.5MB serverless function limit by uploading directly to Blob storage
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate user
        const session = await getSession()
        if (!session?.user) {
          throw new Error('Unauthorized')
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/gif',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm',
            'video/x-m4v',
            'application/pdf',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB max per file
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            orgId: session.user.orgId,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs after the file is successfully uploaded
        // We can use this to log or process the upload
        console.log('[BlobUpload] Upload completed:', blob.url)

        try {
          const payload = JSON.parse(tokenPayload || '{}')
          console.log('[BlobUpload] User:', payload.userId, 'Org:', payload.orgId)
        } catch (e) {
          // Ignore parse errors
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('[BlobUpload] Error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
