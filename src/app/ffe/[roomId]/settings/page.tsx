import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import FFEDepartmentRouter from '@/components/ffe/FFEDepartmentRouter'

interface FFESettingsPageProps {
  params: {
    roomId: string
  }
}

export async function generateMetadata({ params }: FFESettingsPageProps): Promise<Metadata> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: params.roomId },
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

  // Check if user has access to FFE Settings (Admin or Designer only)
  const hasSettingsAccess = session.user.role && ['admin', 'designer'].includes(session.user.role.toLowerCase())
  
  if (!hasSettingsAccess) {
    // Redirect to workspace instead of showing access denied
    redirect(`/ffe/${params.roomId}/workspace`)
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
        initialMode="settings"
        userRole={session.user.role}
        showModeToggle={true}
      />
    </div>
  )
}