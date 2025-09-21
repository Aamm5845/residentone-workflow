import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import PreferencesClient from '@/components/preferences/preferences-client'
import type { Session } from 'next-auth'

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

        <PreferencesClient user={session.user} />
      </div>
    </DashboardLayout>
  )
}