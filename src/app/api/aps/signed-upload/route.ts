import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'

/**
 * POST /api/aps/signed-upload
 *
 * Returns a signed S3 URL for the client to upload a file directly to APS OSS,
 * bypassing Vercel's serverless body size limit.
 *
 * Request JSON body:
 *   - fileName: string (the object key / file name)
 *
 * Response:
 *   - uploadUrl: string (signed S3 PUT URL)
 *   - uploadKey: string (needed to finalize the upload)
 *   - objectKey: string (sanitized object key used in OSS)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apsService.isConfigured()) {
      return NextResponse.json({ error: 'Autodesk APS is not configured' }, { status: 500 })
    }

    const { fileName } = await request.json()
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }

    // Ensure the bucket exists
    await apsService.ensureBucket()

    // Sanitize the object key (same as aps-service.ts uploadFile)
    const objectKey = fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')

    // Get the APS auth token
    const token = await apsService.getToken()

    // Get bucket key from environment
    const APS_CLIENT_ID = process.env.APS_CLIENT_ID || ''
    const BUCKET_KEY = 'residentone-cad-' + (APS_CLIENT_ID.slice(0, 8) || 'default').toLowerCase()

    // Get signed S3 upload URL
    const signedResp = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload?firstPart=1&parts=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!signedResp.ok) {
      const errText = await signedResp.text()
      throw new Error(`APS signed upload request failed (${signedResp.status}): ${errText}`)
    }

    const signedData = await signedResp.json()

    return NextResponse.json({
      uploadUrl: signedData.urls[0],
      uploadKey: signedData.uploadKey,
      objectKey,
      bucketKey: BUCKET_KEY,
    })
  } catch (error: any) {
    console.error('[aps/signed-upload] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get signed upload URL' },
      { status: 500 }
    )
  }
}
