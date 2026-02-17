import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildZoomAuthUrl, isZoomConfigured } from '@/lib/zoom'
import crypto from 'crypto'

/**
 * GET /api/integrations/zoom/connect
 * Initiates the Zoom OAuth flow by redirecting to Zoom's authorization page.
 * Only OWNER and ADMIN roles can connect integrations.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Zoom credentials are configured
  if (!isZoomConfigured()) {
    return NextResponse.json(
      { error: 'Zoom integration is not configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_REDIRECT_URI.' },
      { status: 500 }
    )
  }

  // Only OWNER or ADMIN can connect integrations
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can connect Zoom' },
      { status: 403 }
    )
  }

  // Generate state parameter for CSRF protection
  // Encodes orgId + random nonce so callback can verify the request
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(
    JSON.stringify({ orgId: session.user.orgId, nonce })
  ).toString('base64url')

  const authUrl = buildZoomAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
