import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { projectId } = resolvedParams

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

    // Get spec book generations for this project
    const generations = await prisma.specBookGeneration.findMany({
      where: {
        specBook: {
          projectId: projectId
        }
      },
      include: {
        generatedBy: {
          select: {
            name: true,
            email: true
          }
        },
        specBook: {
          select: {
            name: true,
            project: {
              select: {
                name: true,
                address: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    // Transform the data to match the frontend interface
    const transformedGenerations = generations.map(generation => ({
      id: generation.id,
      version: generation.version,
      status: generation.status,
      pdfUrl: generation.pdfUrl,
      fileSize: generation.fileSize,
      pageCount: generation.pageCount,
      sectionsIncluded: Array.isArray(generation.sectionsIncluded) 
        ? generation.sectionsIncluded 
        : [],
      roomsIncluded: Array.isArray(generation.roomsIncluded) 
        ? generation.roomsIncluded 
        : [],
      coverPageData: {
        clientName: generation.specBook.project.client?.name || 'Client',
        projectName: generation.specBook.project.name,
        address: generation.specBook.project.address || '',
        specBookType: generation.specBook.name || 'Spec Book',
        description: `Generated on ${generation.generatedAt.toLocaleDateString()}`
      },
      generatedAt: generation.generatedAt.toISOString(),
      completedAt: generation.completedAt?.toISOString(),
      downloadCount: generation.downloadCount,
      cadFilesConverted: 0, // Can be enhanced later
      errorMessage: generation.errorMessage,
      generatedBy: {
        name: generation.generatedBy.name,
        email: generation.generatedBy.email
      }
    }))

    return NextResponse.json({
      success: true,
      generations: transformedGenerations
    })

  } catch (error) {
    console.error('Error fetching spec book history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spec book history' },
      { status: 500 }
    )
  }
}