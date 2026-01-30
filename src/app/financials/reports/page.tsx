import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { FinancialReports } from '@/components/financials/FinancialReports'

export default async function ReportsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'OWNER') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout session={session}>
      <FinancialReports />
    </DashboardLayout>
  )
}
