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
    redirect('/auth/signin')
  }

  // Get room information
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          orgId: true
        }
      }
    }
  })
  
  if (!room) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <FFEDepartmentRouter
        roomId={params.roomId}
        roomName={room.name || 'Room'}
        orgId={room.project?.orgId}
        projectId={room.project?.id}
        initialMode="workspace"
        userRole={session.user.role}
        showModeToggle={false}
      />
    </div>
  )
}