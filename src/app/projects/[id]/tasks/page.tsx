import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProjectTasksContent from './components/ProjectTasksContent'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function ProjectTasksPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null
  if (!session?.user) redirect('/auth/signin')

  const { id: projectId } = await params
  const { view } = await searchParams

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { users: { some: { id: session.user.id } } }
    },
    select: {
      id: true,
      name: true
    }
  })

  if (!project) redirect('/projects')

  // Get rooms for this project (for filter/assignment)
  const rooms = await prisma.room.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      type: true,
      stages: {
        select: {
          id: true,
          type: true,
          roomId: true
        }
      }
    },
    orderBy: { order: 'asc' }
  })

  // Get team members in org
  const users = await prisma.user.findMany({
    where: {
      orgId: session.user.orgId,
      approvalStatus: 'APPROVED'
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true
    },
    orderBy: { name: 'asc' }
  })

  // Flatten stages for the form
  const stages = rooms.flatMap(r => r.stages)

  return (
    <DashboardLayout session={session}>
      <ProjectTasksContent
        project={project}
        rooms={rooms.map(r => ({ id: r.id, name: r.name, type: r.type }))}
        stages={stages}
        users={users}
        currentUserId={session.user.id}
        initialView={view || 'list'}
      />
    </DashboardLayout>
  )
}
