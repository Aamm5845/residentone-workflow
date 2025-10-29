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

interface FFESettingsPageProps {
  params: Promise<{
    roomId: string
  }>
}

export async function generateMetadata({ params }: FFESettingsPageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params
    const room = await prisma.room.findUnique({
      where: { id: resolvedParams.roomId },
      select: { name: true }
    })
    return {
      title: `FFE Settings - ${room?.name || 'Room'}`,
      description: `Manage FFE sections, items, templates, and workspace visibility for ${room?.name || 'this room'}`
    }
  } catch {
    return {
      title: 'FFE Settings',
      description: 'Manage FFE sections, items, templates, and workspace visibility'
    }
  }
}

export default async function FFESettingsPage({ params }: FFESettingsPageProps) {
  // Await params first
  const resolvedParams = await params
  
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
    where: { id: resolvedParams.roomId },
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
                FFE Settings
              </h1>
              <p className="text-gray-600">
                {room.name || room.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {room.project?.name} • {room.project?.client?.name}
              </p>
            </div>
          </div>
          
          {/* Workspace Link */}
          <Button asChild variant="outline">
            <Link href={`/ffe/${resolvedParams.roomId}/workspace`} className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Workspace
            </Link>
          </Button>
        </div>

        {/* FFE Content */}
        <FFEDepartmentRouter
          roomId={resolvedParams.roomId}
          roomName={room.name || 'Room'}
          orgId={room.project?.orgId}
          projectId={room.project?.id}
          projectName={room.project?.name}
          initialMode="settings"
          userRole={session.user.role}
          showModeToggle={false}
        />
      </div>
    </DashboardLayout>
  )
}
