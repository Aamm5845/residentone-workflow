import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { DebtPayoffPlan } from '@/components/financials/DebtPayoffPlan'

export default async function DebtPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'OWNER') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout session={session}>
      <DebtPayoffPlan />
    </DashboardLayout>
  )
}
