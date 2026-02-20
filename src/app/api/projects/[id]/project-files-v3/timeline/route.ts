import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Activity timeline: all send events (transmittals + file sends)
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
    const recipientEmail = searchParams.get('recipientEmail')
    const discipline = searchParams.get('discipline')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch transmittals
    const transmittalWhere: any = { projectId: id, status: 'SENT' }
    if (recipientEmail) transmittalWhere.recipientEmail = recipientEmail

    const transmittals = await prisma.transmittal.findMany({
      where: transmittalWhere,
      include: {
        items: {
          include: {
            drawing: {
              select: {
                drawingNumber: true,
                title: true,
                discipline: true,
              },
            },
          },
        },
        sentByUser: { select: { name: true } },
      },
      orderBy: { sentAt: 'desc' },
    })

    // Filter by discipline if specified
    let filteredTransmittals = transmittals
    if (discipline) {
      filteredTransmittals = transmittals.filter((t) =>
        t.items.some((item) => item.drawing.discipline === discipline)
      )
    }

    // Fetch file sends
    const fileSendWhere: any = { projectId: id, sentAt: { not: null } }
    if (recipientEmail) fileSendWhere.recipientEmail = recipientEmail

    const fileSends = await prisma.fileSend.findMany({
      where: fileSendWhere,
      include: {
        sentByUser: { select: { name: true } },
      },
      orderBy: { sentAt: 'desc' },
    })

    // Merge into unified timeline
    const events: any[] = []

    for (const t of filteredTransmittals) {
      events.push({
        type: 'transmittal',
        id: t.id,
        transmittalNumber: t.transmittalNumber,
        recipientName: t.recipientName,
        recipientEmail: t.recipientEmail,
        recipientCompany: t.recipientCompany,
        subject: t.subject,
        sentAt: t.sentAt?.toISOString() ?? t.createdAt.toISOString(),
        sentByName: t.sentByUser?.name ?? 'Unknown',
        items: t.items.map((item) => ({
          drawingNumber: item.drawing.drawingNumber,
          title: item.drawing.title,
          discipline: item.drawing.discipline,
          revisionNumber: item.revisionNumber,
          purpose: item.purpose,
        })),
      })
    }

    for (const fs of fileSends) {
      events.push({
        type: 'file_send',
        id: fs.id,
        recipientName: fs.recipientName,
        recipientEmail: fs.recipientEmail,
        recipientCompany: fs.recipientCompany,
        subject: fs.subject,
        sentAt: fs.sentAt?.toISOString() ?? fs.createdAt.toISOString(),
        sentByName: fs.sentByUser?.name ?? 'Unknown',
        fileName: fs.fileName,
        filePath: fs.filePath,
        fileSize: fs.fileSize,
      })
    }

    // Sort by sentAt descending
    events.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

    // Paginate
    const total = events.length
    const start = (page - 1) * limit
    const paginatedEvents = events.slice(start, start + limit)

    return NextResponse.json({ events: paginatedEvents, total })
  } catch (error) {
    console.error('[project-files-v3/timeline] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }
}
