import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - All transmittals + file sends for a specific recipient or trade
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
    const email = searchParams.get('email')
    const trade = searchParams.get('trade')

    // If trade specified, find all contractor emails with that trade
    let targetEmails: string[] = []

    if (email) {
      targetEmails = [email]
    } else if (trade) {
      const contractors = await prisma.contractor.findMany({
        where: {
          trade: trade as any,
          orgId: session.user.orgId || undefined,
          projectContractors: { some: { projectId: id, isActive: true } },
        },
        select: { email: true },
      })
      targetEmails = contractors.map((c) => c.email)
    }

    if (targetEmails.length === 0) {
      return NextResponse.json({ transmittals: [], fileSends: [] })
    }

    // Get transmittals
    const transmittals = await prisma.transmittal.findMany({
      where: {
        projectId: id,
        status: 'SENT',
        recipientEmail: { in: targetEmails },
      },
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                discipline: true,
                currentRevision: true,
              },
            },
          },
        },
        sentByUser: { select: { name: true } },
      },
      orderBy: { sentAt: 'desc' },
    })

    // Get file sends
    const fileSends = await prisma.fileSend.findMany({
      where: {
        projectId: id,
        recipientEmail: { in: targetEmails },
        sentAt: { not: null },
      },
      include: {
        sentByUser: { select: { name: true } },
      },
      orderBy: { sentAt: 'desc' },
    })

    return NextResponse.json({ transmittals, fileSends })
  } catch (error) {
    console.error('[project-files-v3/recipient-history] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
