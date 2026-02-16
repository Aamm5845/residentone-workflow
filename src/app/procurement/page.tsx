import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import ProcurementProjectList from '@/components/procurement/ProcurementProjectList'

export const dynamic = 'force-dynamic'

export default async function ProcurementPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch all projects with procurement-related counts
  const projects = await prisma.project.findMany({
    where: {
      orgId: session.user.orgId,
      status: { not: 'COMPLETED' },
    },
    select: {
      id: true,
      name: true,
      status: true,
      client: {
        select: {
          id: true,
          name: true,
        }
      },
      _count: {
        select: {
          rfqs: true,
          orders: true,
          clientQuotes: true,
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <DashboardLayout session={session}>
      <ProcurementProjectList projects={projects} />
    </DashboardLayout>
  )
}
