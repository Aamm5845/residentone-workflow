import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { BillsCalendar } from '@/components/financials/BillsCalendar'

export default async function BillsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'OWNER') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout session={session}>
      <BillsCalendar />
    </DashboardLayout>
  )
}
