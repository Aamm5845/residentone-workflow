import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { Session } from 'next-auth'
import InteractiveStagesPage from '@/components/stages/interactive-stages-page'

export default async function Stages({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Handle filtering based on query parameters
  const resolvedSearchParams = await searchParams
  const statusFilter = resolvedSearchParams.status

  // Build where clause based on filters
  const whereClause: any = {}

  if (statusFilter === 'active') {
    whereClause.status = 'IN_PROGRESS' // Only truly active stages
  } else if (statusFilter === 'overdue') {
    whereClause.status = { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] }
    whereClause.dueDate = { lt: new Date() }
  } else if (statusFilter === 'pending') {
    whereClause.status = { in: ['NOT_STARTED', 'PENDING_APPROVAL', 'REVISION_REQUESTED'] }
  } else if (statusFilter === 'completed') {
    whereClause.status = 'COMPLETED'
  }

  // Fetch stages from database
  let stages: any[] = []
  
  try {
    stages = await prisma.stage.findMany({
      where: whereClause,
      include: {
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching stages:', error)
    stages = []
  }



  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {statusFilter === 'active' ? 'Active Stages' :
               statusFilter === 'overdue' ? 'Overdue Stages' :
               statusFilter === 'pending' ? 'Pending Stages' :
               statusFilter === 'completed' ? 'Completed Stages' : 'All Stages'}
            </h1>
            <p className="text-gray-600 mt-1">
              {stages.length} {statusFilter ? statusFilter : ''} stages
            </p>
            {statusFilter && (
              <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
                ← Back to Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* Interactive Stages List with Filters */}
        <InteractiveStagesPage stages={stages} statusFilter={statusFilter} />
      </div>
    </DashboardLayout>
  )
}
