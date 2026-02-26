import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import DashboardV2 from '@/components/dashboard/v2/DashboardV2'
import type { Session } from 'next-auth'

// Prevent static generation
export const dynamic = 'force-dynamic'

export default async function DashboardV2Page() {
  const session = (await getSession()) as
    | (Session & {
        user: {
          id: string
          name: string
          orgId: string
          role: string
        }
      })
    | null

  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <DashboardV2 user={session.user} />
    </DashboardLayout>
  )
}
