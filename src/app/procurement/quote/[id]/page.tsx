import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ClientQuoteDetailView from '@/components/procurement/client-quote-detail-view'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function ClientQuoteDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
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

  const { id } = await params

  return (
    <DashboardLayout>
      <ClientQuoteDetailView
        quoteId={id}
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
