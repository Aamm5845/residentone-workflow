import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { SpecBookBuilder } from '@/components/spec-book/SpecBookBuilder'

interface Props {
  params: { id: string }
}

export default async function SpecBookBuilderPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Fetch project with rooms and existing spec books
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
        rooms: {
          select: {
            id: true,
            name: true,
            type: true
          },
          orderBy: {
            name: 'asc'
          }
        },
        specBooks: {
          where: { isActive: true },
          include: {
            sections: {
              include: {
                dropboxFiles: true,
                room: {
                  select: {
                    id: true,
                    name: true,
                    type: true
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
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

  return (
    <DashboardLayout session={session}>
      <SpecBookBuilder 
        project={project}
        session={session}
      />
    </DashboardLayout>
  )
}

