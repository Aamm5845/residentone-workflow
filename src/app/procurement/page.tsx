import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProcurementDashboard from '@/components/procurement/procurement-dashboard'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProcurementPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      role: string
      name: string
    }
  } | null

  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout>
      <ProcurementDashboard
        user={{
          id: session.user.id,
          name: session.user.name || '',
          role: session.user.role || 'DESIGNER'
        }}
        orgId={session.user.orgId}
      />
    </DashboardLayout>
  )
}
