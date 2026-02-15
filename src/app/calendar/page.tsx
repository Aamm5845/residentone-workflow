import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import CalendarPageClient from '@/components/calendar/calendar-page-client'

// Disable caching to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CalendarPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch all projects with stages that have due dates
  let projects: any[] = []
  let tasks: any[] = []

  try {
    [projects, tasks] = await Promise.all([
      prisma.project.findMany({
        where: {
          status: { not: 'COMPLETED' }
        },
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
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      // Also fetch tasks that have dates
      prisma.task.findMany({
        where: {
          status: { notIn: ['DONE', 'CANCELLED'] },
          OR: [
            { startDate: { not: null } },
            { dueDate: { not: null } }
          ]
        },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        },
        orderBy: { dueDate: 'asc' }
      })
    ])
  } catch (error) {
    console.error('Error fetching calendar data:', error)
    projects = []
    tasks = []
  }

  return (
    <DashboardLayout session={session}>
      <CalendarPageClient
        projects={projects}
        tasks={tasks.map(t => ({
          ...t,
          startDate: t.startDate?.toISOString() || null,
          dueDate: t.dueDate?.toISOString() || null,
        }))}
        currentUser={{
          id: session.user.id,
          name: session.user.name || 'Unknown User',
          email: session.user.email || ''
        }}
      />
    </DashboardLayout>
  )
}
