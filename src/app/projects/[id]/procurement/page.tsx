import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProcurementContent from './components/ProcurementContent'

interface Props {
  params: { id: string }
  searchParams: { tab?: string }
}

export default async function ProjectProcurement({ params, searchParams }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params
  const { tab } = await searchParams

  // Fetch project with client info
  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      }
    }
  })

  if (!project) {
    redirect('/projects')
  }

  // Fetch procurement stats for the status strip
  const [
    pendingQuotes,
    unpaidInvoices,
    overdueOrders,
    upcomingDeliveries
  ] = await Promise.all([
    // Count supplier quotes pending review
    prisma.supplierQuote.count({
      where: {
        supplierRFQ: {
          rfq: { projectId: id }
        },
        status: 'SUBMITTED'
      }
    }),
    // Count unpaid client invoices
    prisma.clientQuote.count({
      where: {
        projectId: id,
        status: 'SENT_TO_CLIENT'
      }
    }),
    // Count overdue orders (expected delivery in past, not delivered)
    prisma.order.count({
      where: {
        projectId: id,
        expectedDelivery: { lt: new Date() },
        status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'] }
      }
    }),
    // Count deliveries expected this week
    prisma.order.count({
      where: {
        projectId: id,
        expectedDelivery: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'] }
      }
    })
  ])

  const stats = {
    pendingQuotes,
    unpaidInvoices,
    overdueOrders,
    upcomingDeliveries
  }

  return (
    <DashboardLayout session={session}>
      <ProcurementContent
        project={project}
        stats={stats}
        initialTab={tab || 'inbox'}
      />
    </DashboardLayout>
  )
}
