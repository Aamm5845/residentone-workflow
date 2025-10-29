import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import FFEDepartmentRouter from '@/components/ffe/FFEDepartmentRouter'
import DashboardLayout from '@/components/layout/dashboard-layout'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface FFEWorkspacePageProps {
  params: {
    roomId: string
  }
}

export async function generateMetadata({ params }: FFEWorkspacePageProps): Promise<Metadata> {
  try {
    const { roomId } = await params
    const room = await prisma.room.findUnique({
      where: { id: roomId },
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
  const { roomId } = await params
  
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
    where: { id: roomId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          orgId: true,
          client: {
            select: {
              name: true
            }
          }
        }
      }
    }
  })
  
  if (!room) {
    notFound()
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header - matching other stages */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/projects/${room.project?.id}`}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                FFE Phase
              </h1>
              <p className="text-gray-600">
                {room.name || room.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {room.project?.name} • {room.project?.client?.name}
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/preferences?tab=ffe" className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
                FFE Management
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/ffe/${roomId}/settings`} className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                Settings
              </Link>
            </Button>
          </div>
        </div>

        {/* FFE Content */}
        <FFEDepartmentRouter
          roomId={roomId}
          roomName={room.name || 'Room'}
          orgId={room.project?.orgId}
          projectId={room.project?.id}
          projectName={room.project?.name}
          initialMode="workspace"
          userRole={session.user.role}
          showModeToggle={false}
        />
      </div>
    </DashboardLayout>
  )
}
