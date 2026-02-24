import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { SpecsWorkspace } from '@/components/workspaces/SpecsWorkspace'

interface Props {
  params: { id: string }
}

export default async function SpecsPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Fetch project with spec book status
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id,
        orgId: session.user.orgId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        specBooks: {
          where: { isActive: true },
          take: 1
        },
        rooms: {
          include: {
            ffeInstance: {
              include: {
                sections: {
                  include: {
                    items: {
                      where: {
                        visibility: 'VISIBLE'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project) {
    redirect('/projects')
  }

  // Redirect if feature is not enabled
  if (!project.hasSpecBook) {
    redirect(`/projects/${id}`)
  }

  // Calculate spec stats - only count actual specs (not FFE Workspace tasks)
  // Task statuses (DRAFT, NEEDS_SPEC, HIDDEN) should NOT be counted
  const taskStatuses = ['DRAFT', 'NEEDS_SPEC', 'HIDDEN']
  let totalItems = 0
  let completedItems = 0

  project.rooms.forEach((room: any) => {
    if (room.ffeInstance) {
      room.ffeInstance.sections.forEach((section: any) => {
        section.items.forEach((item: any) => {
          // Only count items that are actual specs (not tasks)
          if (!item.specStatus || taskStatuses.includes(item.specStatus)) {
            return // Skip task items
          }
          totalItems++
          if (item.specStatus === 'SPECIFIED') {
            completedItems++
          }
        })
      })
    }
  })

  // Determine spec book status
  const specBookStatus = project.specBooks.length > 0 
    ? 'IN_PROGRESS' 
    : 'NOT_STARTED'

  return (
    <DashboardLayout session={session}>
      <SpecsWorkspace 
        project={{
          id: project.id,
          name: project.name,
          client: project.client
        }}
        specBookStatus={specBookStatus}
        totalItems={totalItems}
        completedItems={completedItems}
      />
    </DashboardLayout>
  )
}

