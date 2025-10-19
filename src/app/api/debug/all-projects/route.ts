import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all projects for this user's organization
    const projects = await prisma.project.findMany({
      where: {
        orgId: session.user.orgId
      },
      include: {
        specBooks: {
          where: {
            isActive: true
          },
          include: {
            sections: {
              include: {
                dropboxFiles: {
                  where: {
                    isActive: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    const projectSummary = projects.map(project => ({
      projectId: project.id,
      projectName: project.name,
      hasSpecBook: project.specBooks.length > 0,
      specBooks: project.specBooks.map(specBook => ({
        specBookId: specBook.id,
        specBookName: specBook.name,
        totalSections: specBook.sections.length,
        sectionsWithFiles: specBook.sections.filter(s => s.dropboxFiles.length > 0).length,
        totalLinkedFiles: specBook.sections.reduce((sum, s) => sum + s.dropboxFiles.length, 0),
        sections: specBook.sections.map(section => ({
          sectionName: section.name,
          sectionType: section.type,
          fileCount: section.dropboxFiles.length,
          files: section.dropboxFiles.map(f => ({
            fileName: f.fileName,
            dropboxPath: f.dropboxPath
          }))
        })).filter(s => s.fileCount > 0) // Only show sections with files
      }))
    }))

    return NextResponse.json({
      totalProjects: projects.length,
      projects: projectSummary
    })

  } catch (error) {
    console.error('Debug all projects error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}