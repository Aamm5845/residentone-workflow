import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import WhatsNewContent from './whats-new-content'

export const dynamic = 'force-dynamic'

export default async function WhatsNewPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <WhatsNewContent />
    </DashboardLayout>
  )
}
