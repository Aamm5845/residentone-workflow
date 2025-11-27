import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import TimelineContent from '@/components/timeline/TimelineContent'
import type { Session } from 'next-auth'

export default async function TimelinePage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user) {
    return redirect('/auth/signin')
  }

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
          <p className="text-gray-600 mt-1">
            Track your time and see what your team is working on
          </p>
        </div>
        
        <TimelineContent 
          userId={session.user.id}
          userRole={session.user.role}
          isOwnerOrAdmin={isOwnerOrAdmin}
        />
      </div>
    </DashboardLayout>
  )
}
