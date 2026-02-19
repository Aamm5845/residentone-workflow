import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// POST - Mark a drawing as freshly plotted from its source CAD file
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

    const body = await request.json().catch(() => ({}))
    let cadRevision = body.cadRevision

    // If no revision provided, fetch current from Dropbox
    if (!cadRevision) {
      try {
        const metadata = await dropboxService.getFileMetadata(cadSourceLink.cadDropboxPath)
        if (metadata) {
          cadRevision = metadata.revision
        }
      } catch (err) {
        console.error('[cad-source/mark-plotted] Error fetching Dropbox metadata:', err)
      }
    }

    const updated = await prisma.cadSourceLink.update({
      where: { drawingId },
      data: {
        plottedFromRevision: cadRevision || null,
        plottedAt: new Date(),
        cadFreshnessStatus: 'UP_TO_DATE',
        statusDismissedAt: null,
        statusDismissedBy: null,
        dismissedAtCadRevision: null
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[cad-source/mark-plotted] Error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as plotted' },
      { status: 500 }
    )
  }
}
