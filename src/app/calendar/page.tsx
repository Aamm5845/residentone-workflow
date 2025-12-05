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
  
  try {
    projects = await prisma.project.findMany({
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
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    projects = []
  }

  return (
    <DashboardLayout session={session}>
      <CalendarPageClient 
        projects={projects}
        currentUser={{
          id: session.user.id,
          name: session.user.name || 'Unknown User',
          email: session.user.email || ''
        }}
      />
    </DashboardLayout>
  )
}
