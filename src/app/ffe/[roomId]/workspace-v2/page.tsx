import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import DashboardLayout from '@/components/layout/dashboard-layout'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Beaker, Settings } from 'lucide-react'
import FFESpecsWorkspace from '@/components/ffe/v2/FFESpecsWorkspace'
import { Badge } from '@/components/ui/badge'

interface FFEWorkspaceV2PageProps {
  params: {
    roomId: string
  }
}

export async function generateMetadata({ params }: FFEWorkspaceV2PageProps): Promise<Metadata> {
  try {
    const { roomId } = await params
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { name: true }
    })
    return {
      title: `FFE Specs Workspace V2 - ${room?.name || 'Room'}`,
      description: `New spec-based workspace view for ${room?.name || 'this room'}`
    }
  } catch {
    return {
      title: 'FFE Specs Workspace V2',
      description: 'New spec-based workspace view'
    }
  }
}

export default async function FFEWorkspaceV2Page({ params }: FFEWorkspaceV2PageProps) {
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

  // Verify org access
  if (room.project?.orgId !== session.user.orgId) {
    // Try to get orgId from user record
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { orgId: true }
    })
    
    if (user?.orgId !== room.project?.orgId) {
      redirect('/auth/signin')
    }
  }

  const roomDisplayName = room.name || room.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen">
        {/* Page Header */}
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      FFE Specs Workspace
                    </h1>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      <Beaker className="w-3 h-3 mr-1" />
                      V2 Test
                    </Badge>
                  </div>
                  <p className="text-gray-600">
                    {roomDisplayName} • {room.project?.name} • {room.project?.client?.name}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/ffe/${roomId}/workspace`} className="flex items-center">
                    ← Back to Current Workspace
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/ffe/${roomId}/settings`} className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Test Banner */}
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-3">
          <div className="flex items-center gap-2 text-purple-700">
            <Beaker className="w-4 h-4" />
            <span className="text-sm font-medium">
              This is a test page for the new Programa-style specs workspace. 
              The original workspace is unchanged at <code className="bg-purple-100 px-1 rounded">/ffe/{roomId}/workspace</code>
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-6">
          <FFESpecsWorkspace 
            roomId={roomId} 
            roomName={roomDisplayName}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
