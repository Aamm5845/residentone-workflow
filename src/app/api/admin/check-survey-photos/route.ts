import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Simple query: get all ProjectUpdatePhotos with their project info
    const photos = await prisma.projectUpdatePhoto.findMany({
      where: {
        update: {
          project: { orgId }
        }
      },
      select: {
        id: true,
        takenAt: true,
        asset: {
          select: { url: true, filename: true }
        },
        update: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
                dropboxFolder: true,
              }
            }
          }
        }
      }
    })

    // Group by project
    const projectMap = new Map<string, {
      projectId: string
      projectName: string
      dropboxFolder: string | null
      photos: { id: string; url: string | null; filename: string | null; takenAt: Date | null }[]
    }>()

    for (const photo of photos) {
      const proj = photo.update.project
      if (!projectMap.has(proj.id)) {
        projectMap.set(proj.id, {
          projectId: proj.id,
          projectName: proj.name,
          dropboxFolder: proj.dropboxFolder,
          photos: []
        })
      }
      projectMap.get(proj.id)!.photos.push({
        id: photo.id,
        url: photo.asset?.url || null,
        filename: photo.asset?.filename || null,
        takenAt: photo.takenAt,
      })
    }

    const projects = Array.from(projectMap.values()).map(p => ({
      projectId: p.projectId,
      projectName: p.projectName,
      dropboxFolder: p.dropboxFolder,
      totalSurveyPhotos: p.photos.length,
      samplePaths: p.photos.slice(0, 5).map(ph => ph.url),
    }))

    // Also try to get ProjectSource records
    let sourcesBreakdown: any[] = []
    try {
      sourcesBreakdown = await prisma.projectSource.groupBy({
        by: ['projectId', 'category'],
        _count: { id: true },
        where: { project: { orgId } }
      })
    } catch (e: any) {
      sourcesBreakdown = [{ error: e.message }]
    }

    return NextResponse.json({
      totalProjectsWithSurveyPhotos: projects.length,
      totalSurveyPhotos: photos.length,
      projects,
      sourcesBreakdown,
    })
  } catch (error: any) {
    console.error('[check-survey-photos] Error:', error)
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 })
  }
}
