import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Computed distribution matrix: drawing × recipient → revision data
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

    // Get all non-archived drawings
    const drawings = await prisma.projectDrawing.findMany({
      where: { projectId: id, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        drawingNumber: true,
        title: true,
        discipline: true,
        currentRevision: true,
      },
      orderBy: [{ discipline: 'asc' }, { drawingNumber: 'asc' }],
    })

    // Get all SENT transmittals with items
    const transmittals = await prisma.transmittal.findMany({
      where: { projectId: id, status: 'SENT' },
      select: {
        recipientName: true,
        recipientEmail: true,
        recipientCompany: true,
        recipientType: true,
        sentAt: true,
        transmittalNumber: true,
        items: {
          select: {
            drawingId: true,
            revisionNumber: true,
          },
        },
      },
    })

    // Build unique recipients list
    const recipientMap = new Map<string, {
      email: string
      name: string
      company: string | null
      type: string | null
    }>()

    for (const t of transmittals) {
      if (!t.recipientEmail) continue
      if (!recipientMap.has(t.recipientEmail)) {
        recipientMap.set(t.recipientEmail, {
          email: t.recipientEmail,
          name: t.recipientName,
          company: t.recipientCompany,
          type: t.recipientType,
        })
      }
    }

    // Look up trade info for known contractors
    const recipientEmails = Array.from(recipientMap.keys())
    const contractors = await prisma.contractor.findMany({
      where: {
        email: { in: recipientEmails },
        orgId: session.user.orgId || undefined,
      },
      select: { email: true, trade: true },
    })
    const tradeByEmail = new Map(contractors.map((c) => [c.email, c.trade]))

    const recipients = Array.from(recipientMap.values()).map((r) => ({
      ...r,
      trade: tradeByEmail.get(r.email) || null,
    }))

    // Build matrix: for each drawing+recipient, find max revision sent
    const cells: Record<string, Record<string, any>> = {}

    for (const t of transmittals) {
      if (!t.recipientEmail) continue
      for (const item of t.items) {
        const drawingId = item.drawingId
        if (!cells[drawingId]) cells[drawingId] = {}

        const existing = cells[drawingId][t.recipientEmail]
        const rev = item.revisionNumber ?? 0

        if (!existing || rev > existing.revisionNumber) {
          cells[drawingId][t.recipientEmail] = {
            revisionNumber: rev,
            sentAt: t.sentAt?.toISOString() ?? '',
            transmittalNumber: t.transmittalNumber,
            isLatest: false,
          }
        }
      }
    }

    // Compute isLatest
    for (const drawing of drawings) {
      const row = cells[drawing.id]
      if (!row) continue
      for (const email of Object.keys(row)) {
        row[email].isLatest = row[email].revisionNumber >= drawing.currentRevision
      }
    }

    return NextResponse.json({ drawings, recipients, cells })
  } catch (error) {
    console.error('[project-files-v3/distribution-matrix] Error:', error)
    return NextResponse.json({ error: 'Failed to build matrix' }, { status: 500 })
  }
}
