import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List transmittals with items and drawing info
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
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = { projectId: id }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { recipientName: { contains: search, mode: 'insensitive' } },
        { recipientCompany: { contains: search, mode: 'insensitive' } },
        { transmittalNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } }
      ]
    }

    const transmittals = await prisma.transmittal.findMany({
      where,
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
            },
            revision: {
              select: {
                id: true,
                revisionNumber: true
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
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      transmittals,
      total: transmittals.length
    })
  } catch (error) {
    console.error('[project-files-v2/transmittals] Error fetching transmittals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transmittals' },
      { status: 500 }
    )
  }
}

// POST - Create a new transmittal with items
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
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      subject,
      recipientName,
      recipientEmail,
      recipientCompany,
      recipientType,
      method,
      notes,
      items
    } = body

    if (!recipientName) {
      return NextResponse.json(
        { error: 'recipientName is required' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item (drawing) is required' },
        { status: 400 }
      )
    }

    // Create transmittal and items in a transaction
    const transmittal = await prisma.$transaction(async (tx) => {
      // Count existing transmittals for this project to auto-generate number
      const existingCount = await tx.transmittal.count({
        where: { projectId: id }
      })

      const transmittalNumber = `T-${String(existingCount + 1).padStart(3, '0')}`

      // Create the transmittal
      const newTransmittal = await tx.transmittal.create({
        data: {
          projectId: id,
          transmittalNumber,
          subject: subject || null,
          recipientName,
          recipientEmail: recipientEmail || null,
          recipientCompany: recipientCompany || null,
          recipientType: recipientType || null,
          method: method || 'EMAIL',
          notes: notes || null,
          createdBy: session.user!.id
        }
      })

      // Create transmittal items
      for (const item of items) {
        await tx.transmittalItem.create({
          data: {
            transmittalId: newTransmittal.id,
            drawingId: item.drawingId,
            revisionId: item.revisionId || null,
            revisionNumber: item.revisionNumber || null,
            purpose: item.purpose || null,
            notes: item.notes || null
          }
        })
      }

      // Return the full transmittal with items
      return tx.transmittal.findUnique({
        where: { id: newTransmittal.id },
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
              },
              revision: {
                select: {
                  id: true,
                  revisionNumber: true
                }
              }
            }
          },
          creator: {
            select: { id: true, name: true, image: true }
          }
        }
      })
    })

    return NextResponse.json(transmittal, { status: 201 })
  } catch (error) {
    console.error('[project-files-v2/transmittals] Error creating transmittal:', error)
    return NextResponse.json(
      { error: 'Failed to create transmittal' },
      { status: 500 }
    )
  }
}
