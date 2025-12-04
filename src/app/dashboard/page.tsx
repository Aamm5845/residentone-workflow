import { Suspense } from 'react'
import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InteractiveDashboard from '@/components/dashboard/interactive-dashboard'
import type { Session } from 'next-auth'

// Prevent static generation for pages using useSearchParams
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <InteractiveDashboard user={session.user} />
    </DashboardLayout>
  )
}
