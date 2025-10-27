import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get spec book for this project
    const specBook = await prisma.specBook.findFirst({
      where: {
        projectId,
        isActive: true
      }
    })

    if (!specBook) {
      // No spec book yet, return empty history
      return NextResponse.json({
        success: true,
        generations: []
      })
    }

    // Fetch all generations for this spec book
    const generations = await prisma.specBookGeneration.findMany({
      where: {
        specBookId: specBook.id
      },
      include: {
        generatedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    // Transform the data to match the expected format
    const transformedGenerations = generations.map(gen => {
      let coverPageData
      let sectionsIncluded
      let roomsIncluded

      try {
        coverPageData = typeof gen.coverPageData === 'string' 
          ? JSON.parse(gen.coverPageData) 
          : gen.coverPageData
      } catch {
        coverPageData = {}
      }

      try {
        sectionsIncluded = typeof gen.sectionsIncluded === 'string'
          ? JSON.parse(gen.sectionsIncluded)
          : gen.sectionsIncluded
      } catch {
        sectionsIncluded = []
      }

      try {
        roomsIncluded = typeof gen.roomsIncluded === 'string'
          ? JSON.parse(gen.roomsIncluded)
          : gen.roomsIncluded
      } catch {
        roomsIncluded = []
      }

      return {
        id: gen.id,
        version: gen.version,
        status: gen.status,
        pdfUrl: gen.pdfUrl,
        fileSize: gen.fileSize,
        pageCount: gen.pageCount,
        sectionsIncluded,
        roomsIncluded,
        coverPageData,
        generatedAt: gen.generatedAt.toISOString(),
        completedAt: gen.completedAt?.toISOString(),
        downloadCount: gen.downloadCount,
        cadFilesConverted: 0, // Not tracked in current schema
        errorMessage: gen.errorMessage,
        lastDownloadedAt: gen.downloadedAt?.toISOString() || null,
        lastDownloadedBy: null, // Not tracked in current schema
        generatedBy: gen.generatedBy
      }
    })

    return NextResponse.json({
      success: true,
      generations: transformedGenerations
    })

  } catch (error) {
    console.error('Error fetching spec book history:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
