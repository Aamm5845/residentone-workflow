import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProjectSpecsView from '@/components/specs/ProjectSpecsView'

interface Props {
  params: { id: string }
}

export default async function AllSpecsPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Fetch project
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id,
        orgId: session.user.orgId
      },
      select: {
        id: true,
        name: true,
        hasSpecBook: true
      }
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project) {
    redirect('/projects')
  }

  // Redirect if feature is not enabled
  if (!project.hasSpecBook) {
    redirect(`/projects/${id}`)
  }

  return (
    <DashboardLayout session={session}>
      <ProjectSpecsView 
        project={{
          id: project.id,
          name: project.name
        }}
      />
    </DashboardLayout>
  )
}

