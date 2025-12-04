import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ActivitiesContent from '@/components/activities/ActivitiesContent'
import type { Session } from 'next-auth'

// Prevent static generation for pages using useSearchParams
export const dynamic = 'force-dynamic'

export default async function ActivitiesPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    return redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-600 mt-1">
            Recent activities across your organization
          </p>
        </div>
        
        <ActivitiesContent />
      </div>
    </DashboardLayout>
  )
}
