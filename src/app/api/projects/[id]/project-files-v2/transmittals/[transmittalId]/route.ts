import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Full transmittal with items, each item includes drawing + revision info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transmittalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, transmittalId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const transmittal = await prisma.transmittal.findFirst({
      where: { id: transmittalId, projectId: id },
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                discipline: true,
                drawingType: true,
                currentRevision: true,
                status: true
              }
            },
            revision: {
              select: {
                id: true,
                revisionNumber: true,
                description: true,
                issuedDate: true,
                dropboxUrl: true,
                fileName: true
              }
            }
          }
        },
        creator: {
          select: { id: true, name: true, image: true }
        },
        sentByUser: {
          select: { id: true, name: true }
        }
      }
    })

    if (!transmittal) {
      return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    }

    return NextResponse.json(transmittal)
  } catch (error) {
    console.error('[project-files-v2/transmittals/[transmittalId]] Error fetching transmittal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transmittal' },
      { status: 500 }
    )
  }
}

// PATCH - Update transmittal (status, notes, sentAt, sentBy)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transmittalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, transmittalId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify transmittal exists for this project
    const existing = await prisma.transmittal.findFirst({
      where: { id: transmittalId, projectId: id },
      select: { id: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    }

    const body = await request.json()

    // Only allow updating specific fields
    const allowedFields = ['status', 'notes', 'sentAt', 'sentBy']
    const data: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Convert sentAt string to Date if provided
        if (field === 'sentAt' && body[field]) {
          data[field] = new Date(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const transmittal = await prisma.transmittal.update({
      where: { id: transmittalId },
      data,
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                discipline: true
              }
            }
          }
        },
        creator: {
          select: { id: true, name: true, image: true }
        },
        sentByUser: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(transmittal)
  } catch (error) {
    console.error('[project-files-v2/transmittals/[transmittalId]] Error updating transmittal:', error)
    return NextResponse.json(
      { error: 'Failed to update transmittal' },
      { status: 500 }
    )
  }
}
