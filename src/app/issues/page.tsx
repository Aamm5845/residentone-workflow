import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import IssueList from '@/components/issues/issue-list'

export default async function IssuesPage() {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <IssueList 
            currentUser={{
              id: session.user.id,
              name: session.user.name || '',
              role: session.user.role
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}