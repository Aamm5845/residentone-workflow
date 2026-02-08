import { Suspense } from 'react'
import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProcurementInbox from '@/components/procurement/ProcurementInbox'
import { Inbox } from 'lucide-react'
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
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Inbox className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Procurement Inbox</h1>
            <p className="text-gray-600 mt-0.5">
              Actionable items across all your projects
            </p>
          </div>
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
