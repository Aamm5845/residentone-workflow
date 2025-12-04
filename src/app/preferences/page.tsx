import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import PreferencesClient from '@/components/preferences/preferences-client'
import type { Session } from 'next-auth'

// Prevent static generation for pages using useSearchParams
export const dynamic = 'force-dynamic'

export default async function PreferencesPage() {
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
            <p className="text-gray-600 mt-1">
              Manage your application settings and preferences
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="animate-pulse bg-gray-100 rounded-lg h-96"></div>}>
          <PreferencesClient user={session.user} />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
