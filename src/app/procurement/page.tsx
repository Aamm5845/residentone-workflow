import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import SimplifiedProcurementDashboard from '@/components/procurement/simplified-procurement-dashboard'
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
    <DashboardLayout session={session}>
      <SimplifiedProcurementDashboard />
    </DashboardLayout>
  )
}
