import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ClientSourcesWorkspace } from '@/components/workspaces/ClientSourcesWorkspace'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientSourcesPage({ params }: PageProps) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id: projectId } = await params

  // Fetch project with client info
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      orgId: session.user.orgId
    },
    select: {
      id: true,
      name: true,
      dropboxFolder: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  if (!project) {
    redirect('/projects')
  }

  return (
    <DashboardLayout session={session}>
      <ClientSourcesWorkspace project={project} />
    </DashboardLayout>
  )
}

