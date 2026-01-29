import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { AllTransactions } from '@/components/financials/AllTransactions'

export default async function TransactionsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'OWNER') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout session={session}>
      <AllTransactions />
    </DashboardLayout>
  )
}
