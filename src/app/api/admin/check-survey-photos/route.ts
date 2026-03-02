import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = (session.user as any).orgId

  // Find projects that have ProjectUpdatePhotos (survey photos stored in 7- SOURCES/Site Photos)
  const projectsWithSurveyPhotos = await prisma.project.findMany({
    where: {
      orgId,
      updates: {
        some: {
          photos: { some: {} }
        }
      }
    },
    select: {
      id: true,
      name: true,
      dropboxFolder: true,
      _count: {
        select: {
          updates: true
        }
      },
      updates: {
        where: { photos: { some: {} } },
        select: {
          id: true,
          title: true,
          _count: { select: { photos: true } },
          photos: {
            select: {
              id: true,
              takenAt: true,
              asset: {
                select: { url: true }
              }
            }
          }
        }
      }
    }
  })

  // Also check ProjectSource records (files uploaded to 7- SOURCES)
  const projectsWithSources = await prisma.projectSource.groupBy({
    by: ['projectId', 'category'],
    _count: { id: true },
    where: {
      project: { orgId }
    }
  })

  const summary = projectsWithSurveyPhotos.map(p => {
    const totalPhotos = p.updates.reduce((sum, u) => sum + u.photos.length, 0)
    const dropboxPaths = p.updates.flatMap(u =>
      u.photos.map(ph => ph.asset?.url).filter(Boolean)
    )
    return {
      projectId: p.id,
      projectName: p.name,
      dropboxFolder: p.dropboxFolder,
      totalSurveyPhotos: totalPhotos,
      updatesWithPhotos: p.updates.length,
      samplePaths: dropboxPaths.slice(0, 3),
    }
  })

  return NextResponse.json({
    totalProjectsWithSurveyPhotos: summary.length,
    totalSurveyPhotos: summary.reduce((s, p) => s + p.totalSurveyPhotos, 0),
    projects: summary,
    sourcesBreakdown: projectsWithSources,
  })
}
