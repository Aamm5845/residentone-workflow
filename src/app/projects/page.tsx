import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InteractiveProjectsPage from '@/components/projects/interactive-projects-page'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export default async function Projects({ searchParams }: { searchParams: Promise<{ status?: string, timeframe?: string }> }) {
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
  const timeframeFilter = resolvedSearchParams.timeframe

  // Build where clause based on filters
  const whereClause: any = {}
  
  if (statusFilter === 'active') {
    // Active projects are those that have started any phase and not all rooms are complete
    whereClause.AND = [
      // Must have at least one stage that's been started (not NOT_STARTED)
      {
        rooms: {
          some: {
            stages: {
              some: {
                status: { not: 'NOT_STARTED' }
              }
            }
          }
        }
      },
      // Must not have ALL rooms with ALL applicable stages completed
      {
        NOT: {
          rooms: {
            every: {
              stages: {
                every: {
                  OR: [
                    { status: 'COMPLETED' },
                    { status: 'NOT_APPLICABLE' }
                  ]
                }
              }
            }
          }
        }
      }
    ]
  } else if (statusFilter === 'completed') {
    whereClause.status = 'COMPLETED'
    
    if (timeframeFilter === 'month') {
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      whereClause.updatedAt = { gte: firstDayOfMonth }
    }
  }

  // Fetch projects from database with fallback handling
  let projects: any[] = []
  
  try {
    projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { 
            rooms: true,
            assets: true,
            approvals: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    // Fallback to basic query without new columns if migration hasn't run yet
    try {
      projects = await prisma.project.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          status: true,
          dueDate: true,
          budget: true,
          coverImages: true,
          createdAt: true,
          updatedAt: true,
          client: true,
          rooms: {
            include: {
              stages: {
                include: {
                  assignedUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: { 
              rooms: true,
              assets: true,
              approvals: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError)
      projects = []
    }
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <InteractiveProjectsPage 
          projects={projects} 
          statusFilter={statusFilter} 
          timeframeFilter={timeframeFilter}
          currentUser={{
            id: session.user.id,
            name: session.user.name || 'Unknown User',
            email: session.user.email || ''
          }}
        />
      </div>
    </DashboardLayout>
  )
}
