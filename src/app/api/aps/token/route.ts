import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'

/**
 * GET /api/aps/token
 * Returns a viewer-only access token for the Autodesk Viewer SDK (client-side)
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apsService.isConfigured()) {
      return NextResponse.json({ error: 'Autodesk APS is not configured' }, { status: 500 })
    }

    const token = await apsService.getViewerToken()

    return NextResponse.json({
      success: true,
      access_token: token.access_token,
      expires_in: token.expires_in,
    })
  } catch (error: any) {
    console.error('[aps/token] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get viewer token' },
      { status: 500 }
    )
  }
}
