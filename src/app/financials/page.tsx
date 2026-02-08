import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import FinancialsPageClient from '@/components/financials/FinancialsPageClient'

export default async function FinancialsPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check financials access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, canSeeFinancials: true },
  })

  if (user?.role !== 'OWNER' && !user?.canSeeFinancials) {
    redirect('/dashboard')
  }

  const isOwner = user?.role === 'OWNER'

  return (
    <DashboardLayout session={session as any}>
      <Suspense fallback={<div className="p-8 text-center">Loading financials...</div>}>
        <FinancialsPageClient isOwner={isOwner} />
      </Suspense>
    </DashboardLayout>
  )
}
