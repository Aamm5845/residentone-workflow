import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Single drawing with revisions, transmittal items, and floor info
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

    const drawing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      include: {
        floor: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        revisions: {
          orderBy: { revisionNumber: 'desc' },
          include: {
            issuedByUser: {
              select: { id: true, name: true, image: true }
            }
          }
        },
        transmittalItems: {
          include: {
            transmittal: {
              select: {
                id: true,
                transmittalNumber: true,
                recipientName: true,
                recipientCompany: true,
                sentAt: true,
                status: true
              }
            },
            revision: {
              select: {
                id: true,
                revisionNumber: true
              }
            }
          },
          orderBy: { transmittal: { createdAt: 'desc' } }
        },
        creator: {
          select: { id: true, name: true, image: true }
        }
      }
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    return NextResponse.json(drawing)
  } catch (error) {
    console.error('[project-files-v2/drawings/[drawingId]] Error fetching drawing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drawing' },
      { status: 500 }
    )
  }
}

// PATCH - Update drawing fields
export async function PATCH(
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
    const existing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    const body = await request.json()

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'discipline',
      'drawingType',
      'floorId',
      'description',
      'dropboxPath',
      'dropboxUrl',
      'fileName',
      'fileSize',
      'scale',
      'paperSize',
      'status'
    ]

    const data: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const drawing = await prisma.projectDrawing.update({
      where: { id: drawingId },
      data,
      include: {
        floor: {
          select: { id: true, name: true, shortName: true }
        }
      }
    })

    return NextResponse.json(drawing)
  } catch (error) {
    console.error('[project-files-v2/drawings/[drawingId]] Error updating drawing:', error)
    return NextResponse.json(
      { error: 'Failed to update drawing' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete (set status to ARCHIVED)
export async function DELETE(
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
    const existing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    // Soft delete - set status to ARCHIVED
    const drawing = await prisma.projectDrawing.update({
      where: { id: drawingId },
      data: { status: 'ARCHIVED' }
    })

    return NextResponse.json({ success: true, drawing })
  } catch (error) {
    console.error('[project-files-v2/drawings/[drawingId]] Error archiving drawing:', error)
    return NextResponse.json(
      { error: 'Failed to archive drawing' },
      { status: 500 }
    )
  }
}
