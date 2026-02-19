import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List revisions for a drawing, ordered by revisionNumber DESC
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, drawingId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify drawing exists for this project
    const drawing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    const revisions = await prisma.drawingRevision.findMany({
      where: { drawingId },
      orderBy: { revisionNumber: 'desc' },
      include: {
        issuedByUser: {
          select: { id: true, name: true, image: true }
        }
      }
    })

    return NextResponse.json(revisions)
  } catch (error) {
    console.error('[project-files-v2/revisions] Error fetching revisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revisions' },
      { status: 500 }
    )
  }
}

// POST - Create a new revision for a drawing
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

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify drawing exists for this project
    const drawing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    const body = await request.json()
    const { description, dropboxPath, dropboxUrl, fileName, fileSize, sourceCadPath, sourceCadRevision } = body

    // Create revision and update drawing in a transaction
    const revision = await prisma.$transaction(async (tx) => {
      // Find max revision number for this drawing
      const maxRevision = await tx.drawingRevision.findFirst({
        where: { drawingId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true }
      })

      const newRevisionNumber = (maxRevision?.revisionNumber ?? 0) + 1

      // Create the new revision
      const newRevision = await tx.drawingRevision.create({
        data: {
          drawingId,
          revisionNumber: newRevisionNumber,
          description: description || null,
          dropboxPath: dropboxPath || null,
          dropboxUrl: dropboxUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          issuedBy: session.user!.id,
          sourceCadPath: sourceCadPath || null,
          sourceCadRevision: sourceCadRevision || null
        },
        include: {
          issuedByUser: {
            select: { id: true, name: true, image: true }
          }
        }
      })

      // Update the parent drawing's currentRevision field
      await tx.projectDrawing.update({
        where: { id: drawingId },
        data: { currentRevision: newRevisionNumber }
      })

      // If this drawing has a CadSourceLink, auto-update it to UP_TO_DATE
      if (sourceCadRevision) {
        const existingLink = await tx.cadSourceLink.findUnique({
          where: { drawingId }
        })

        if (existingLink) {
          await tx.cadSourceLink.update({
            where: { drawingId },
            data: {
              plottedFromRevision: sourceCadRevision,
              plottedAt: new Date(),
              cadFreshnessStatus: 'UP_TO_DATE',
              statusDismissedAt: null,
              statusDismissedBy: null,
              dismissedAtCadRevision: null
            }
          })
        }
      }

      return newRevision
    })

    return NextResponse.json(revision, { status: 201 })
  } catch (error) {
    console.error('[project-files-v2/revisions] Error creating revision:', error)
    return NextResponse.json(
      { error: 'Failed to create revision' },
      { status: 500 }
    )
  }
}
