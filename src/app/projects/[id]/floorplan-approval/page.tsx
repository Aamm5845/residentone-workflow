import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import FloorplanApprovalWorkspace from '@/components/workspaces/FloorplanApprovalWorkspace'

interface Props {
  params: { id: string }
}

export default async function FloorplanApprovalPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with client info
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

  return (
    <DashboardLayout session={session}>
      <FloorplanApprovalWorkspace 
        project={project}
      />
    </DashboardLayout>
  )
}