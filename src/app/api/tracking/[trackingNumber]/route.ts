import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { getTracking } from '@/lib/ship24'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tracking/[trackingNumber]
 * Get tracking info for a package
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trackingNumber } = await params

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Tracking number required' }, { status: 400 })
    }

    const result = await getTracking(trackingNumber)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Tracking API error:', error)
    return NextResponse.json(
      { error: 'Failed to get tracking info' },
      { status: 500 }
    )
  }
}
