import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// POST - Bulk link multiple drawings to a single CAD file
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

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { cadDropboxPath, mappings } = body

    if (!cadDropboxPath || !Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        { error: 'cadDropboxPath and mappings[] are required' },
        { status: 400 }
      )
    }

    // Verify all drawings belong to this project
    const drawingIds = mappings.map((m: any) => m.drawingId)
    const drawings = await prisma.projectDrawing.findMany({
      where: { id: { in: drawingIds }, projectId: id },
      select: { id: true }
    })

    const validIds = new Set(drawings.map(d => d.id))
    const validMappings = mappings.filter((m: any) => validIds.has(m.drawingId))

    if (validMappings.length === 0) {
      return NextResponse.json(
        { error: 'No valid drawings found for this project' },
        { status: 400 }
      )
    }

    // Create/update CadSourceLinks for each mapping
    const results = await prisma.$transaction(
      validMappings.map((m: any) =>
        prisma.cadSourceLink.upsert({
          where: { drawingId: m.drawingId },
          create: {
            drawingId: m.drawingId,
            cadDropboxPath,
            cadLayoutName: m.layoutName || null,
            cadFreshnessStatus: 'UNKNOWN'
          },
          update: {
            cadDropboxPath,
            cadLayoutName: m.layoutName || null
          }
        })
      )
    )

    return NextResponse.json({
      linked: results.length,
      links: results
    })
  } catch (error) {
    console.error('[cad-source/auto-link] Error:', error)
    return NextResponse.json(
      { error: 'Failed to auto-link drawings' },
      { status: 500 }
    )
  }
}
