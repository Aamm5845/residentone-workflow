import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, ClipboardList, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProjectUpdatesTabs from '@/components/project-updates/project-updates-tabs'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function ProjectUpdatesPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with comprehensive data
  let project: any = null
  let projectUpdates: any[] = []
  let photos: any[] = []
  let tasks: any[] = []
  let availableUsers: any[] = []
  let availableContractors: any[] = []
  
  try {
    // Fetch project
    project = await prisma.project.findFirst({
      where: { 
        id: id,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      },
      select: {
        id: true,
        name: true,
        hasProjectUpdates: true,
        status: true,
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
            type: true,
            status: true
          }
        },
        organization: {
          select: {
            id: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
              }
            }
          }
        },
        projectContractors: {
          select: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                contactName: true,
                email: true,
                specialty: true
              }
            }
          },
          where: {
            isActive: true
          }
        }
      }
    })

    if (project && project.hasProjectUpdates) {
      // TODO: Fetch real project updates from API
      projectUpdates = []

      // TODO: Fetch real photos from API
      photos = []

      // TODO: Fetch real tasks from API
      tasks = []

      // Extract available users and contractors
      availableUsers = project.organization.users
      availableContractors = project.projectContractors.map((pc: any) => pc.contractor)
    }
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project) {
    redirect('/projects')
  }

  // Redirect if feature is not enabled
  if (!project.hasProjectUpdates) {
    redirect(`/projects/${id}`)
  }


  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Enhanced Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Project
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Update
                </Button>
              </div>
            </div>
            
            {/* Project Header */}
            <div className="mt-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ClipboardList className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Project Updates</h1>
                  <p className="text-lg text-gray-600 mt-1">{project.name} • {project.client.name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{photos.length} photos</span>
                    <span>{tasks.length} tasks</span>
                    <span>{projectUpdates.length} updates</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <ProjectUpdatesTabs
            projectId={project.id}
            project={project}
            projectUpdates={projectUpdates}
            photos={photos}
            tasks={tasks}
            availableUsers={availableUsers}
            availableContractors={availableContractors}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}