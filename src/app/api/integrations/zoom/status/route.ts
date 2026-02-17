import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isZoomConfigured } from '@/lib/zoom'

/**
 * GET /api/integrations/zoom/status
 * Returns the Zoom integration status for the current organization.
 * Used by the Settings UI and ScheduleMeetingDialog to check connection state.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Zoom is even configured in environment
  if (!isZoomConfigured()) {
    return NextResponse.json({
      connected: false,
      configured: false,
    })
  }

  const integration = await prisma.zoomIntegration.findUnique({
    where: { orgId: session.user.orgId },
    select: {
      id: true,
      status: true,
      zoomEmail: true,
      createdAt: true,
      connectedBy: {
        select: { name: true, email: true },
      },
    },
  })

  if (!integration || integration.status !== 'ACTIVE') {
    return NextResponse.json({
      connected: false,
      configured: true,
      status: integration?.status || null,
    })
  }

  return NextResponse.json({
    connected: true,
    configured: true,
    email: integration.zoomEmail,
    connectedAt: integration.createdAt,
    connectedBy: integration.connectedBy?.name || integration.connectedBy?.email,
  })
}
