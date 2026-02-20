import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List drawings with revisions and transmittal distribution info
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

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const discipline = searchParams.get('discipline')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = { projectId: id }

    if (discipline) where.discipline = discipline
    if (status) {
      where.status = status
    } else {
      where.status = { not: 'ARCHIVED' }
    }
    if (search) {
      where.OR = [
        { drawingNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ]
    }

    const drawings = await prisma.projectDrawing.findMany({
      where,
      include: {
        floor: { select: { id: true, name: true, shortName: true } },
        revisions: {
          orderBy: { revisionNumber: 'desc' },
          select: {
            id: true,
            revisionNumber: true,
            description: true,
            issuedDate: true,
            issuedBy: true,
            issuedByUser: { select: { name: true } },
          },
        },
        transmittalItems: {
          where: {
            transmittal: { status: 'SENT' }
          },
          select: {
            revisionNumber: true,
            transmittal: {
              select: {
                id: true,
                transmittalNumber: true,
                recipientName: true,
                recipientEmail: true,
                sentAt: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: [{ discipline: 'asc' }, { drawingNumber: 'asc' }],
    })

    // Compute distribution stats for each drawing
    const enrichedDrawings = drawings.map((drawing) => {
      const sentItems = drawing.transmittalItems
      // Get unique recipients by email
      const recipientMap = new Map<string, { maxRev: number }>()
      for (const item of sentItems) {
        const email = item.transmittal.recipientEmail
        if (!email) continue
        const existing = recipientMap.get(email)
        const rev = item.revisionNumber ?? 0
        if (!existing || rev > existing.maxRev) {
          recipientMap.set(email, { maxRev: rev })
        }
      }

      const recipientCount = recipientMap.size
      let outdatedRecipientCount = 0
      for (const [, data] of recipientMap) {
        if (data.maxRev < drawing.currentRevision) {
          outdatedRecipientCount++
        }
      }

      // Last transmittal
      const lastSent = sentItems
        .filter((item) => item.transmittal.sentAt)
        .sort((a, b) => {
          const aDate = a.transmittal.sentAt ? new Date(a.transmittal.sentAt).getTime() : 0
          const bDate = b.transmittal.sentAt ? new Date(b.transmittal.sentAt).getTime() : 0
          return bDate - aDate
        })[0]

      const { transmittalItems, ...drawingData } = drawing

      return {
        ...drawingData,
        recipientCount,
        outdatedRecipientCount,
        lastTransmittal: lastSent
          ? {
              recipientName: lastSent.transmittal.recipientName,
              sentAt: lastSent.transmittal.sentAt?.toISOString() ?? null,
              revisionNumber: lastSent.revisionNumber ?? 0,
            }
          : null,
      }
    })

    return NextResponse.json({ drawings: enrichedDrawings })
  } catch (error) {
    console.error('[project-files-v3/drawings] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drawings' },
      { status: 500 }
    )
  }
}
