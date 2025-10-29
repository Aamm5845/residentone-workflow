import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InboxContent from '@/components/inbox/InboxContent'
import type { Session } from 'next-auth'

export default async function InboxPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600 mt-1">
            Your @mentions and direct messages
          </p>
        </div>
        
        <InboxContent />
      </div>
    </DashboardLayout>
  )
}
