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
  let teamOffDays: any[] = []
  let meetings: any[] = []

  try {
    [projects, tasks, teamOffDays, meetings] = await Promise.all([
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
      }),
      // Fetch team off days (vacation, sick, etc.)
      prisma.userOffDay.findMany({
        where: {
          user: { orgId: session.user.orgId }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { date: 'asc' }
      }),
      // Fetch meetings for the organization
      prisma.meeting.findMany({
        where: {
          orgId: session.user.orgId,
          status: { not: 'CANCELLED' },
        },
        include: {
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              client: { select: { id: true, name: true, email: true } },
              contractor: { select: { id: true, businessName: true, contactName: true, email: true, type: true } },
            },
          },
          project: { select: { id: true, name: true } },
          organizer: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
    ])
  } catch (error) {
    console.error('Error fetching calendar data:', error)
    projects = []
    tasks = []
    teamOffDays = []
    meetings = []
  }

  // Get flat project list for meeting dialog
  const projectList = projects.map(p => ({
    id: p.id,
    name: p.name,
    streetAddress: p.streetAddress || null,
    city: p.city || null,
    province: p.province || null,
    postalCode: p.postalCode || null,
  }))

  return (
    <DashboardLayout session={session}>
      <CalendarPageClient
        projects={projects}
        tasks={tasks.map(t => ({
          ...t,
          startDate: t.startDate?.toISOString() || null,
          dueDate: t.dueDate?.toISOString() || null,
        }))}
        teamOffDays={teamOffDays.map(od => ({
          id: od.id,
          userId: od.userId,
          userName: od.user.name || 'Unknown',
          date: od.date.toISOString().split('T')[0],
          reason: od.reason,
          notes: od.notes,
        }))}
        meetings={meetings.map(m => ({
          ...m,
          date: m.date.toISOString(),
          startTime: m.startTime.toISOString(),
          endTime: m.endTime.toISOString(),
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
          attendees: m.attendees.map((a: any) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          })),
        }))}
        projectList={projectList}
        currentUser={{
          id: session.user.id,
          name: session.user.name || 'Unknown User',
          email: session.user.email || '',
          role: (session.user as any).role || 'VIEWER',
        }}
      />
    </DashboardLayout>
  )
}
