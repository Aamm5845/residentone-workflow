import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/integrations/zoom/disconnect
 * Disconnects the Zoom integration for the organization.
 * Sets status to REVOKED (soft delete for audit trail).
 * Only OWNER and ADMIN roles can disconnect.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only OWNER or ADMIN can disconnect integrations
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Only owners and admins can disconnect Zoom' },
      { status: 403 }
    )
  }

  // Soft-delete: mark as REVOKED (preserves audit trail)
  const result = await prisma.zoomIntegration.updateMany({
    where: { orgId: session.user.orgId, status: 'ACTIVE' },
    data: { status: 'REVOKED' },
  })

  if (result.count === 0) {
    return NextResponse.json(
      { error: 'No active Zoom integration found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
