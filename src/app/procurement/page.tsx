import { Suspense } from 'react'
import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProcurementInbox from '@/components/procurement/ProcurementInbox'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function ProcurementPage() {
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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Procurement Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">
            Actionable items across all your projects
          </p>
        </div>
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
          </div>
        }>
          <ProcurementInbox />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
