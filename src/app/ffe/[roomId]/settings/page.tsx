import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import FFEDepartmentRouter from '@/components/ffe/FFEDepartmentRouter'

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
        roomId={resolvedParams.roomId}
        roomName={room.name || 'Room'}
        orgId={room.project?.orgId}
        projectId={room.project?.id}
        initialMode="settings"
        userRole={session.user.role}
        showModeToggle={false}
      />
    </div>
  )
}