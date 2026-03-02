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

    // Get all photos
    const photos = await prisma.projectUpdatePhoto.findMany({
      select: {
        id: true,
        updateId: true,
        assetId: true,
        takenAt: true,
      }
    })

    if (photos.length === 0) {
      return NextResponse.json({
        totalProjectsWithSurveyPhotos: 0,
        totalSurveyPhotos: 0,
        projects: [],
        sourcesBreakdown: [],
      })
    }

    // Get the update IDs to find which projects they belong to
    const updateIds = [...new Set(photos.map(p => p.updateId))]
    const updates = await prisma.projectUpdate.findMany({
      where: { id: { in: updateIds } },
      select: { id: true, projectId: true, title: true }
    })
    const updateMap = new Map(updates.map(u => [u.id, u]))

    // Get project IDs
    const projectIds = [...new Set(updates.map(u => u.projectId))]
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds }, orgId },
      select: { id: true, name: true, dropboxFolder: true }
    })
    const projectMap = new Map(projects.map(p => [p.id, p]))

    // Get asset URLs for sample paths
    const assetIds = photos.map(p => p.assetId)
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, url: true, filename: true }
    })
    const assetMap = new Map(assets.map(a => [a.id, a]))

    // Group photos by project
    const projectPhotos = new Map<string, { urls: string[]; count: number }>()

    for (const photo of photos) {
      const update = updateMap.get(photo.updateId)
      if (!update) continue
      const project = projectMap.get(update.projectId)
      if (!project) continue

      if (!projectPhotos.has(project.id)) {
        projectPhotos.set(project.id, { urls: [], count: 0 })
      }
      const entry = projectPhotos.get(project.id)!
      entry.count++
      const asset = assetMap.get(photo.assetId)
      if (asset?.url && entry.urls.length < 5) {
        entry.urls.push(asset.url)
      }
    }

    const result = Array.from(projectPhotos.entries()).map(([projectId, data]) => {
      const project = projectMap.get(projectId)!
      return {
        projectId,
        projectName: project.name,
        dropboxFolder: project.dropboxFolder,
        totalSurveyPhotos: data.count,
        samplePaths: data.urls,
      }
    })

    // Also try to get ProjectSource records
    let sourcesBreakdown: any[] = []
    try {
      sourcesBreakdown = await prisma.projectSource.groupBy({
        by: ['projectId', 'category'],
        _count: { id: true },
        where: { project: { orgId } }
      })
    } catch {
      // ProjectSource may not have relations either
      try {
        const sources = await prisma.projectSource.findMany({
          select: { projectId: true, category: true }
        })
        const grouped = new Map<string, number>()
        for (const s of sources) {
          const key = `${s.projectId}|${s.category}`
          grouped.set(key, (grouped.get(key) || 0) + 1)
        }
        sourcesBreakdown = Array.from(grouped.entries()).map(([key, count]) => {
          const [projectId, category] = key.split('|')
          return { projectId, category, count }
        })
      } catch (e2: any) {
        sourcesBreakdown = [{ error: e2.message }]
      }
    }

    return NextResponse.json({
      totalProjectsWithSurveyPhotos: result.length,
      totalSurveyPhotos: photos.length,
      projects: result,
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
