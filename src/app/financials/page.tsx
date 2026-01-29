import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { FinancialDashboard } from '@/components/financials/FinancialDashboard'

export default async function FinancialsPage() {
  const session = await getSession()

  // Must be authenticated
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Only OWNER can access this page
  if (session.user.role !== 'OWNER') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout session={session}>
      <FinancialDashboard />
    </DashboardLayout>
  )
}
