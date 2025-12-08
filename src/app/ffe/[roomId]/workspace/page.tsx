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
import { PhaseChat } from '@/components/chat/PhaseChat'
import { WorkspaceTimerButton } from '@/components/timeline/WorkspaceTimerButton'
import FFEActivityLogPanel from '@/components/ffe/v2/FFEActivityLogPanel'

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

  // Get room information and FFE stage
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
      },
      stages: {
        where: {
          type: 'FFE'
        }
      }
    }
  })
  
  if (!room) {
    notFound()
  }

  // Get or create FFE stage
  let ffeStage = room.stages[0]
  if (!ffeStage) {
    // Create FFE stage if it doesn't exist
    ffeStage = await prisma.stage.create({
      data: {
        roomId: room.id,
        type: 'FFE',
        status: 'NOT_STARTED'
      }
    })
  }

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen">
        {/* Page Header - matching settings page */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
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
                {/* V2 Test Link */}
                <Button asChild variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
                  <Link href={`/ffe/${roomId}/workspace-v2`} className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>
                    Test V2 Workspace
                  </Link>
                </Button>
                <WorkspaceTimerButton
                  projectId={room.project?.id || ''}
                  roomId={roomId}
                  stageId={ffeStage.id}
                  stageType="FFE"
                />
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
          </div>
        </div>

        {/* FFE Content with Chat Sidebar */}
        <div className="flex h-[calc(100vh-64px)]">
          {/* Main FFE Workspace */}
          <div className="flex-1 overflow-auto px-6 py-6">
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

          {/* Right Sidebar - Activity Log & Chat */}
          <div className="w-96 border-l border-gray-200/60 bg-white flex flex-col">
            {/* Activity Log - Compact */}
            <div className="h-44 border-b border-gray-100 flex-shrink-0">
              <FFEActivityLogPanel roomId={roomId} />
            </div>
            
            {/* Chat - Fills remaining space */}
            <div className="flex-1 overflow-hidden">
              <PhaseChat
                stageId={ffeStage.id}
                stageName={`FFE - ${room.name || room.type}`}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
