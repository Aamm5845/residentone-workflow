import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'

/**
 * POST /api/aps/signed-upload/finalize
 *
 * Finalizes a direct-to-S3 upload and returns the URN.
 * Called after the client has successfully PUT the file to S3.
 *
 * Request JSON body:
 *   - objectKey: string
 *   - uploadKey: string (from the signed upload response)
 *
 * Response:
 *   - urn: string (base64url-encoded objectId)
 *   - objectKey: string
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

    const { objectKey, uploadKey } = await request.json()
    if (!objectKey || !uploadKey) {
      return NextResponse.json({ error: 'objectKey and uploadKey are required' }, { status: 400 })
    }

    const token = await apsService.getToken()

    // Get bucket key from environment
    const APS_CLIENT_ID = process.env.APS_CLIENT_ID || ''
    const BUCKET_KEY = 'residentone-cad-' + (APS_CLIENT_ID.slice(0, 8) || 'default').toLowerCase()

    // Finalize the upload with APS
    const finalizeResp = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uploadKey }),
      }
    )

    if (!finalizeResp.ok) {
      const errText = await finalizeResp.text()
      throw new Error(`APS upload finalize failed (${finalizeResp.status}): ${errText}`)
    }

    const data = await finalizeResp.json()
    const objectId = data.objectId // urn:adsk.objects:os.object:bucket/key
    const urn = Buffer.from(objectId).toString('base64url')

    return NextResponse.json({
      urn,
      objectKey,
      objectId,
    })
  } catch (error: any) {
    console.error('[aps/signed-upload/finalize] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to finalize upload' },
      { status: 500 }
    )
  }
}
