import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { FloorplanPhasesWorkspace } from '@/components/workspaces/FloorplanPhasesWorkspace'

interface Props {
  params: { id: string }
}

export default async function FloorplanPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with client info and floorplan approval status
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        dueDate: true,
        budget: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        // Check if project has feature flag enabled
        hasFloorplanApproval: true
      }
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project) {
    redirect('/projects')
  }

  // Feature flag check
  if (!project.hasFloorplanApproval) {
    redirect(`/projects/${project.id}`)
  }

  // Fetch floorplan approval versions to determine phase statuses
  const floorplanVersions = await prisma.floorplanApprovalVersion.findMany({
    where: {
      projectId: project.id
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      version: true,
      status: true,
      clientDecision: true,
      createdAt: true,
      assets: {
        select: {
          id: true
        }
      }
    }
  })

  // Calculate phase statuses
  const hasVersions = floorplanVersions.length > 0
  const currentVersion = floorplanVersions[0]
  const hasAssets = currentVersion?.assets && currentVersion.assets.length > 0
  
  // Check if any version has been pushed to approval (status != DRAFT)
  const hasPushedVersions = floorplanVersions.some(v => v.status !== 'DRAFT')
  const pushedVersions = floorplanVersions.filter(v => v.status !== 'DRAFT')
  const latestPushedVersion = pushedVersions[0]
  
  // Check if latest pushed version has revision requested
  const revisionRequested = latestPushedVersion?.clientDecision === 'REVISION_REQUESTED'
  
  // Determine Drawings phase status
  // - NOT_STARTED: no versions at all
  // - IN_PROGRESS: has versions but none pushed yet (all DRAFT), OR revision requested
  // - COMPLETED: at least one version pushed to approval AND not revision requested
  let drawingsStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED'
  if (hasPushedVersions && !revisionRequested) {
    drawingsStatus = 'COMPLETED'
  } else if (hasVersions || revisionRequested) {
    drawingsStatus = 'IN_PROGRESS'
  }
  
  // Determine Approval phase status
  // - NOT_STARTED: no pushed versions
  // - IN_PROGRESS: pushed but not yet client approved (includes revision requested)
  // - COMPLETED: client approved
  let approvalStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED'
  if (latestPushedVersion?.clientDecision === 'APPROVED') {
    approvalStatus = 'COMPLETED'
  } else if (hasPushedVersions) {
    approvalStatus = 'IN_PROGRESS'
  }

  // Get sources count (will return 0 if table doesn't exist yet)
  let sourcesCount = 0
  try {
    sourcesCount = await prisma.projectSource.count({
      where: { projectId: project.id }
    })
  } catch (e) {
    // Table might not exist yet - migration pending
    console.log('[floorplan] ProjectSource table not ready yet')
  }

  return (
    <DashboardLayout session={session}>
      <FloorplanPhasesWorkspace 
        project={project}
        drawingsStatus={drawingsStatus}
        approvalStatus={approvalStatus}
        sourcesCount={sourcesCount}
        currentVersionId={currentVersion?.id}
        hasAssets={hasAssets}
        revisionRequested={revisionRequested}
      />
    </DashboardLayout>
  )
}

