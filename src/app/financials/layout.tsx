import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { FinancialsLayout } from '@/components/financials/FinancialsLayout'

export default async function FinancialsRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
      <FinancialsLayout>{children}</FinancialsLayout>
    </DashboardLayout>
  )
}
