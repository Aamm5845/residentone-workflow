import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, ClipboardList, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProjectUpdatesTabs from '@/components/project-updates/project-updates-tabs'
import ProjectUpdatesHeader from '@/components/project-updates/ProjectUpdatesHeader'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function ProjectUpdatesPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with comprehensive data
  let project: any = null
  let projectUpdates: any[] = []
  let photos: any[] = []
  let tasks: any[] = []
  let availableUsers: any[] = []
  let availableContractors: any[] = []
  let openIssuesCount: number = 0
  
  try {
    // Fetch project
    project = await prisma.project.findFirst({
      where: { 
        id: id,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      },
      select: {
        id: true,
        name: true,
        hasProjectUpdates: true,
        status: true,
        dropboxFolder: true,
        linkedDropboxFolders: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rooms: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        },
        organization: {
          select: {
            id: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
              }
            }
          }
        },
        projectContractors: {
          select: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                contactName: true,
                email: true,
                specialty: true
              }
            }
          },
          where: {
            isActive: true
          }
        }
      }
    })

    if (project && project.hasProjectUpdates) {
      // Fetch project updates with author info
      projectUpdates = await prisma.projectUpdate.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: true,
          _count: {
            select: {
              tasks: true
            }
          }
        }
      })

      // Fetch author info for each update
      const authorIds = [...new Set(projectUpdates.map(u => u.authorId))]
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, email: true, image: true }
      })
      const authorMap = new Map(authors.map(a => [a.id, a]))

      // Fetch all photos belonging to these updates with asset and uploader info
      const updateIds = projectUpdates.map(u => u.id)
      const rawPhotos = updateIds.length > 0
        ? await prisma.projectUpdatePhoto.findMany({
            where: {
              updateId: { in: updateIds }
            },
            orderBy: { createdAt: 'desc' }
          })
        : []

      // Join assets manually since ProjectUpdatePhoto has no Prisma relation in schema
      const assetIds = Array.from(new Set(rawPhotos.map(p => p.assetId)))
      const assets = assetIds.length > 0
        ? await prisma.asset.findMany({
            where: { id: { in: assetIds } },
            select: {
              id: true,
              title: true,
              filename: true,
              url: true,
              type: true,
              size: true,
              mimeType: true,
              metadata: true,
              createdAt: true,
              uploadedByUser: {
                select: { id: true, name: true, email: true, image: true }
              }
            }
          })
        : []
      const assetById = new Map(assets.map(a => [a.id, a]))

      // Map uploadedByUser to uploader for compatibility with PhotoGallery component
      photos = rawPhotos.map(photo => {
        const asset = assetById.get(photo.assetId)
        return {
          ...photo,
          asset: asset
            ? { 
                ...asset, 
                // Serve through our proxy route so Next/Image can load reliably
                url: `/api/assets/${asset.id}/file`,
                uploader: asset.uploadedByUser 
              }
            : null
        }
      })

      // Compute photo counts per update and attach author
      const photoCounts = new Map<string, number>()
      for (const p of rawPhotos) {
        photoCounts.set(p.updateId, (photoCounts.get(p.updateId) || 0) + 1)
      }

      projectUpdates = projectUpdates.map(update => {
        // Check if this is an internal update (like photo uploads) that shouldn't show in Recent Updates feed
        const metadata = update.metadata as Record<string, any> | null
        const isInternalByFlag = metadata?.isInternal === true
        
        // Also detect legacy site survey entries (before the flag was added)
        // Site surveys have type 'PHOTO' and descriptions like "X photos from site survey"
        const isLegacySiteSurvey = update.type === 'PHOTO' && 
          (update.description?.toLowerCase().includes('from site survey') ||
           update.title?.toLowerCase().includes('site survey'))
        
        const isInternal = isInternalByFlag || isLegacySiteSurvey
        
        return {
          ...update,
          author: authorMap.get(update.authorId) || { id: update.authorId, name: 'Unknown', email: '' },
          isInternal, // Flag for filtering in UI
          _count: {
            ...update._count,
            photos: photoCounts.get(update.id) || 0,
            documents: 0,
            messages: 0
          }
        }
      })

      // TODO: Fetch real tasks from API
      tasks = []

      // Extract available users and contractors
      availableUsers = project.organization.users
      availableContractors = project.projectContractors.map((pc: any) => pc.contractor)

      // Fetch open issues count for this project
      openIssuesCount = await prisma.issue.count({
        where: {
          projectId: id,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      })
    }
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project) {
    redirect('/projects')
  }

  // Redirect if feature is not enabled
  if (!project.hasProjectUpdates) {
    redirect(`/projects/${id}`)
  }


  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        <ProjectUpdatesHeader
          project={project}
          photos={photos}
          tasks={tasks}
          projectUpdates={projectUpdates}
          rooms={project.rooms}
        />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <ProjectUpdatesTabs
            projectId={project.id}
            project={project}
            projectUpdates={projectUpdates}
            photos={photos}
            tasks={tasks}
            availableUsers={availableUsers}
            availableContractors={availableContractors}
            openIssuesCount={openIssuesCount}
            linkedDropboxFolders={project.linkedDropboxFolders as any[] | null}
            dropboxFolder={project.dropboxFolder}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}