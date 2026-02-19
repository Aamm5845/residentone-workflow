import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// POST - Mark a drawing as needing re-plot
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

    const updated = await prisma.cadSourceLink.update({
      where: { drawingId },
      data: {
        cadFreshnessStatus: 'NEEDS_REPLOT'
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[cad-source/needs-replot] Error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as needs replot' },
      { status: 500 }
    )
  }
}
