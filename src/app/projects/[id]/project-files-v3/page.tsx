import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ProjectFilesV3Workspace } from '@/components/project-files-v3/ProjectFilesV3Workspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectFilesV3Page({ params }: Props) {
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth/signin')
  }
  const { id } = await params

  const project = await prisma.project.findFirst({
    where: { id, orgId: session.user.orgId || undefined },
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
      <ProjectFilesV3Workspace project={project} />
    </DashboardLayout>
  )
}
