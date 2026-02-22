import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

interface FileCheck {
  title: string
  sectionId: string
  pageNo?: string | null
}

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
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { files } = body as { files: FileCheck[] }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Build OR conditions for batch lookup
    const conditions = files.map((f) => ({
      projectId: id,
      title: { equals: f.title.trim(), mode: 'insensitive' as const },
      sectionId: f.sectionId,
      ...(f.pageNo ? { pageNo: f.pageNo } : {}),
      status: { not: 'ARCHIVED' as const },
    }))

    // Query all potential matches in one go
    const allMatches = await prisma.projectDrawing.findMany({
      where: {
        OR: conditions,
      },
      select: {
        id: true,
        drawingNumber: true,
        title: true,
        currentRevision: true,
        sectionId: true,
        pageNo: true,
        section: { select: { name: true, shortName: true } },
      },
    })

    // Map results back to each file index
    const results = files.map((f, index) => {
      const titleLower = f.title.trim().toLowerCase()
      const match = allMatches.find(
        (m) =>
          m.title.toLowerCase() === titleLower &&
          m.sectionId === f.sectionId &&
          (!f.pageNo || m.pageNo === f.pageNo)
      )

      return {
        fileIndex: index,
        existingDrawing: match
          ? {
              id: match.id,
              drawingNumber: match.drawingNumber,
              title: match.title,
              currentRevision: match.currentRevision,
              sectionShortName: match.section?.shortName || null,
            }
          : null,
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[check-duplicates] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check duplicates' },
      { status: 500 }
    )
  }
}
