import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List drawings with filters and sidebar counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const floorId = searchParams.get('floorId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = { projectId: id }

    if (sectionId) {
      where.sectionId = sectionId
    }

    if (floorId) {
      where.floorId = floorId
    }

    if (type) {
      where.drawingType = type
    }

    if (status) {
      where.status = status
    } else {
      // Default: exclude ARCHIVED
      where.status = { not: 'ARCHIVED' }
    }

    if (search) {
      where.OR = [
        { drawingNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch drawings with relations
    const drawings = await prisma.projectDrawing.findMany({
      where,
      include: {
        floor: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        section: {
          select: {
            id: true,
            name: true,
            shortName: true,
            color: true
          }
        },
        revisions: {
          select: { id: true },
          orderBy: { revisionNumber: 'desc' }
        },
        transmittalItems: {
          include: {
            transmittal: {
              select: {
                id: true,
                transmittalNumber: true,
                recipientName: true,
                sentAt: true,
                status: true
              }
            }
          },
          orderBy: { transmittal: { createdAt: 'desc' } },
          take: 1
        },
        cadSourceLink: {
          select: {
            id: true,
            cadDropboxPath: true,
            cadLayoutName: true,
            cadFreshnessStatus: true,
            plottedFromRevision: true,
            plottedAt: true
          }
        }
      },
      orderBy: [
        { drawingNumber: 'asc' }
      ]
    })

    // Transform — field names must match DrawingRegisterTable / DrawingRegisterCards interfaces
    const transformedDrawings = drawings.map((drawing) => {
      const { revisions, transmittalItems, ...rest } = drawing
      const lastTransmittal = transmittalItems[0]?.transmittal ?? null
      return {
        ...rest,
        _count: {
          revisions: revisions.length,
          transmittalItems: transmittalItems.length
        },
        lastTransmittal
      }
    })

    // Fetch counts per section (for sidebar filter), excluding ARCHIVED
    const sectionCounts = await prisma.projectDrawing.groupBy({
      by: ['sectionId'],
      where: { projectId: id, status: { not: 'ARCHIVED' } },
      _count: { id: true }
    })

    // Fetch counts per floor (for sidebar filter), excluding ARCHIVED
    const floorCounts = await prisma.projectDrawing.groupBy({
      by: ['floorId'],
      where: { projectId: id, status: { not: 'ARCHIVED' } },
      _count: { id: true }
    })

    // Fetch counts per status (for sidebar filter)
    const statusCounts = await prisma.projectDrawing.groupBy({
      by: ['status'],
      where: { projectId: id },
      _count: { id: true }
    })

    return NextResponse.json({
      drawings: transformedDrawings,
      counts: {
        bySection: sectionCounts.map((c) => ({
          sectionId: c.sectionId,
          count: c._count.id
        })),
        byFloor: floorCounts.map((c) => ({
          floorId: c.floorId,
          count: c._count.id
        })),
        byStatus: statusCounts.map((c) => ({
          status: c.status,
          count: c._count.id
        }))
      },
      total: transformedDrawings.length
    })
  } catch (error) {
    console.error('[project-files-v2/drawings] Error fetching drawings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drawings' },
      { status: 500 }
    )
  }
}

// POST - Create a new drawing with initial revision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      drawingNumber,
      title,
      sectionId,
      drawingType,
      floorId,
      description,
      dropboxPath,
      dropboxUrl,
      fileName,
      fileSize,
      scale,
      paperSize
    } = body

    if (!drawingNumber || !title) {
      return NextResponse.json(
        { error: 'drawingNumber and title are required' },
        { status: 400 }
      )
    }

    // Create drawing and initial revision in a transaction
    const drawing = await prisma.$transaction(async (tx) => {
      const newDrawing = await tx.projectDrawing.create({
        data: {
          projectId: id,
          drawingNumber,
          title,
          sectionId: sectionId || null,
          drawingType: drawingType || null,
          floorId: floorId || null,
          description: description || null,
          dropboxPath: dropboxPath || null,
          dropboxUrl: dropboxUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          scale: scale || null,
          paperSize: paperSize || null,
          currentRevision: 1,
          createdBy: session.user!.id
        }
      })

      // Auto-create initial revision #1
      await tx.drawingRevision.create({
        data: {
          drawingId: newDrawing.id,
          revisionNumber: 1,
          description: 'Initial revision',
          dropboxPath: dropboxPath || null,
          dropboxUrl: dropboxUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          issuedBy: session.user!.id
        }
      })

      // Return drawing with relations
      return tx.projectDrawing.findUnique({
        where: { id: newDrawing.id },
        include: {
          floor: {
            select: { id: true, name: true, shortName: true }
          },
          section: {
            select: { id: true, name: true, shortName: true, color: true }
          },
          revisions: true
        }
      })
    })

    return NextResponse.json(drawing, { status: 201 })
  } catch (error) {
    console.error('[project-files-v2/drawings] Error creating drawing:', error)
    return NextResponse.json(
      { error: 'Failed to create drawing' },
      { status: 500 }
    )
  }
}
