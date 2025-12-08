import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import TemplatesManager from '@/components/templates/templates-manager'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <TemplatesManager 
        userId={session.user.id} 
        orgId={session.user.orgId}
        userRole={session.user.role}
      />
    </DashboardLayout>
  )
}
