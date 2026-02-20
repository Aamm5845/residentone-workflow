import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProjectFilesWorkspace from '@/components/project-files/ProjectFilesWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectFilesV2Page({ params }: Props) {
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth/signin')
  }
  const { id } = await params

  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      dropboxFolder: true,
      client: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  if (!project) {
    redirect('/projects')
  }

  return (
    <DashboardLayout session={session as any}>
      <ProjectFilesWorkspace project={project} />
    </DashboardLayout>
  )
}
