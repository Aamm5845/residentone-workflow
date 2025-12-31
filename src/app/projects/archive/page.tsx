import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InteractiveProjectsPage from '@/components/projects/interactive-projects-page'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

// Disable caching to ensure fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ArchiveProjects() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch archived projects (COMPLETED or ON_HOLD status)
  let projects: any[] = []
  
  try {
    projects = await prisma.project.findMany({
      where: {
        status: { in: ['COMPLETED', 'ON_HOLD'] }
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
    console.error('Error fetching archived projects:', error)
    projects = []
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <InteractiveProjectsPage 
          projects={projects} 
          showArchive={true}
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


