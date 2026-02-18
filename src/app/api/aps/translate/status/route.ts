import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'

/**
 * GET /api/aps/translate/status?urn=<urn>
 * Check translation status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apsService.isConfigured()) {
      return NextResponse.json({ error: 'Autodesk APS is not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const urn = searchParams.get('urn')

    if (!urn) {
      return NextResponse.json({ error: 'urn parameter is required' }, { status: 400 })
    }

    const status = await apsService.getTranslationStatus(urn)

    // Include region info for debugging
    const debugInfo = status.status === 'inprogress' && status.progress === '0%'
      ? { note: 'Translation is queued/initializing on Autodesk servers. Large files with many xrefs can take 5-15 minutes.' }
      : {}

    return NextResponse.json({
      success: true,
      ...status,
      ...debugInfo,
    })
  } catch (error: any) {
    console.error('[aps/translate/status] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Status check failed' },
      { status: 500 }
    )
  }
}
