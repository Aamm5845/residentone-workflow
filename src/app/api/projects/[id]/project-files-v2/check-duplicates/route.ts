import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

interface FileCheck {
  title: string
  sectionId: string
  pageNo?: string | null
  fileName?: string | null
}

/**
 * Extract a drawing number from a filename using the same pattern as send-files.
 * E.g. "A-101 Something.pdf" → "A-101"
 */
function extractDrawingNumber(filename: string): string | null {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  const match = nameWithoutExt.match(/^([A-Z]{1,4}[\s_.-]?\d{1,4}[A-Z]?)/i)
  if (match) return match[1].replace(/[\s_]/g, '-').toUpperCase()
  return null
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
      where: { id },
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

    // Build OR conditions for title-based batch lookup
    const titleConditions = files.map((f) => ({
      projectId: id,
      title: { equals: f.title.trim(), mode: 'insensitive' as const },
      sectionId: f.sectionId,
      ...(f.pageNo ? { pageNo: f.pageNo } : {}),
      status: { not: 'ARCHIVED' as const },
    }))

    // Extract drawing numbers from filenames for drawing-number-based lookup
    const drawingNumbers = files.map((f) =>
      f.fileName ? extractDrawingNumber(f.fileName) : null
    )
    const uniqueDrawingNumbers = [...new Set(drawingNumbers.filter(Boolean))] as string[]

    // Query title matches
    const titleMatches = await prisma.projectDrawing.findMany({
      where: {
        OR: titleConditions,
      },
      select: {
        id: true,
        drawingNumber: true,
        title: true,
        currentRevision: true,
        status: true,
        sectionId: true,
        pageNo: true,
        section: { select: { name: true, shortName: true } },
      },
    })

    // Query drawing number matches (if any filenames yielded drawing numbers)
    let numberMatches: typeof titleMatches = []
    if (uniqueDrawingNumbers.length > 0) {
      numberMatches = await prisma.projectDrawing.findMany({
        where: {
          projectId: id,
          drawingNumber: { in: uniqueDrawingNumbers },
          status: { not: 'ARCHIVED' },
        },
        select: {
          id: true,
          drawingNumber: true,
          title: true,
          currentRevision: true,
          status: true,
          sectionId: true,
          pageNo: true,
          section: { select: { name: true, shortName: true } },
        },
      })
    }

    // Map results back to each file index — title match takes priority
    const results = files.map((f, index) => {
      const titleLower = f.title.trim().toLowerCase()
      const titleMatch = titleMatches.find(
        (m) =>
          m.title.toLowerCase() === titleLower &&
          m.sectionId === f.sectionId &&
          (!f.pageNo || m.pageNo === f.pageNo)
      )

      if (titleMatch) {
        return {
          fileIndex: index,
          existingDrawing: {
            id: titleMatch.id,
            drawingNumber: titleMatch.drawingNumber,
            title: titleMatch.title,
            currentRevision: titleMatch.currentRevision,
            status: titleMatch.status,
            sectionShortName: titleMatch.section?.shortName || null,
          },
          matchType: 'title' as const,
        }
      }

      // Fall back to drawing number match from filename
      const extractedNumber = drawingNumbers[index]
      if (extractedNumber) {
        const numberMatch = numberMatches.find(
          (m) => m.drawingNumber === extractedNumber
        )
        if (numberMatch) {
          return {
            fileIndex: index,
            existingDrawing: {
              id: numberMatch.id,
              drawingNumber: numberMatch.drawingNumber,
              title: numberMatch.title,
              currentRevision: numberMatch.currentRevision,
              status: numberMatch.status,
              sectionShortName: numberMatch.section?.shortName || null,
            },
            matchType: 'drawingNumber' as const,
          }
        }
      }

      return {
        fileIndex: index,
        existingDrawing: null,
        matchType: null,
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
