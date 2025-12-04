import { Suspense } from 'react'
import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ReportsGallery } from '@/components/reports/ReportsGallery'
import type { Session } from 'next-auth'

// Prevent static generation for pages using useSearchParams
export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
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
      <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading reports...</div>}>
        <ReportsGallery />
      </Suspense>
    </DashboardLayout>
  )
}
