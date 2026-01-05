import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import FFEUnifiedWorkspace from '@/components/ffe/FFEUnifiedWorkspace'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { PhaseChat } from '@/components/chat/PhaseChat'
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
        {/* FFE Content with Chat Sidebar */}
        <div className="flex h-screen">
          {/* Main FFE Workspace - Unified */}
          <div className="flex-1 overflow-auto">
            <FFEUnifiedWorkspace
              roomId={roomId}
              roomName={room.name || 'Room'}
              orgId={room.project?.orgId}
              projectId={room.project?.id}
              projectName={room.project?.name}
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
