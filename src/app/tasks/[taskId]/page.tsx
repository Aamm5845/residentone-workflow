import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import TaskDetailPage from './components/TaskDetailPage'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function TaskPage({
  params
}: {
  params: Promise<{ taskId: string }>
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

  const { taskId } = await params

  // Verify task exists and user has access
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        organization: { users: { some: { id: session.user.id } } }
      }
    },
    select: { id: true, projectId: true }
  })

  if (!task) redirect('/tasks')

  // Get available users for assignee dropdown
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

  // Get rooms for the task's project
  const rooms = await prisma.room.findMany({
    where: { projectId: task.projectId },
    select: { id: true, name: true, type: true },
    orderBy: { order: 'asc' }
  })

  return (
    <DashboardLayout session={session}>
      <TaskDetailPage
        taskId={taskId}
        availableUsers={users}
        availableRooms={rooms}
        currentUserId={session.user.id}
      />
    </DashboardLayout>
  )
}
