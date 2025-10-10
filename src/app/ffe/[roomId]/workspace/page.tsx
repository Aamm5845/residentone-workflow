import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import FFEDepartmentRouter from '@/components/ffe/FFEDepartmentRouter'

interface FFEWorkspacePageProps {
  params: {
    roomId: string
  }
}

export async function generateMetadata({ params }: FFEWorkspacePageProps): Promise<Metadata> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: params.roomId },
      select: { name: true }
    })
    return {
      title: `FFE Workspace - ${room?.name || 'Room'}`,
      description: `Execute FFE tasks and track progress for ${room?.name || 'this room'}`
    }
  } catch {
    return {
      title: 'FFE Workspace',
      description: 'Execute FFE tasks and track progress'
    }
  }
}

export default async function FFEWorkspacePage({ params }: FFEWorkspacePageProps) {
  // Get current user session and validate permissions
  const session = await getSession() as Session & {
    user: {
      id: string
      name?: string
      email?: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/login')
  }

  // Check if user has workflow access (Admin, Designer, FFE Specialist)
  const hasWorkflowAccess = session.user.role && ['admin', 'designer', 'ffe', 'ffe_specialist'].includes(session.user.role.toLowerCase())
  
  if (!hasWorkflowAccess) {
    // Redirect to projects if no workflow access
    redirect('/projects')
  }

  // Get room information
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          organizationId: true
        }
      }
    }
  })
  
  if (!room) {
    notFound()
  }

  // Check if user has access to this room/project
  const hasRoomAccess = session.user.orgId === room.project?.organizationId ||
                       session.user.role === 'admin'

  if (!hasRoomAccess) {
    redirect('/projects')
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <FFEDepartmentRouter
        roomId={params.roomId}
        roomName={room.name || 'Room'}
        orgId={room.project?.organizationId}
        projectId={room.project?.id}
        initialMode="workspace"
        userRole={session.user.role}
        showModeToggle={true}
      />
    </div>
  )
}