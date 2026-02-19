import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// POST - Dismiss a CAD_MODIFIED warning for this drawing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, drawingId } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const cadSourceLink = await prisma.cadSourceLink.findUnique({
      where: { drawingId }
    })

    if (!cadSourceLink) {
      return NextResponse.json(
        { error: 'No CAD source link found for this drawing' },
        { status: 404 }
      )
    }

    // Get current CAD revision so we can track what was dismissed
    let currentRevision: string | null = null
    try {
      const metadata = await dropboxService.getFileMetadata(cadSourceLink.cadDropboxPath)
      if (metadata) {
        currentRevision = metadata.revision
      }
    } catch (err) {
      // Non-critical — still allow dismiss
    }

    const updated = await prisma.cadSourceLink.update({
      where: { drawingId },
      data: {
        cadFreshnessStatus: 'DISMISSED',
        statusDismissedAt: new Date(),
        statusDismissedBy: session.user.id,
        dismissedAtCadRevision: currentRevision
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[cad-source/dismiss] Error:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss warning' },
      { status: 500 }
    )
  }
}
