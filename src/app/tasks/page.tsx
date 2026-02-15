import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import MyTasksContent from './components/MyTasksContent'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; tab?: string }>
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

  const { view, tab } = await searchParams

  // Get team members in org
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

  // Get all projects in org for filtering
  const projects = await prisma.project.findMany({
    where: {
      organization: { users: { some: { id: session.user.id } } }
    },
    select: {
      id: true,
      name: true
    },
    orderBy: { name: 'asc' }
  })

  return (
    <DashboardLayout session={session}>
      <MyTasksContent
        users={users}
        projects={projects}
        currentUserId={session.user.id}
        currentUserName={session.user.name || ''}
        initialView={view || 'list'}
        initialTab={tab || 'assigned_to_me'}
      />
    </DashboardLayout>
  )
}
