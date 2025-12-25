import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import MessagingWorkspace from '@/components/messaging/MessagingWorkspace'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      name: string
      role: string
    }
  } | null
  
  if (!session?.user) {
    return redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <MessagingWorkspace />
    </DashboardLayout>
  )
}

