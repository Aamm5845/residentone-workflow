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
      // Mock data for demonstration (replace with actual API calls)
      projectUpdates = [
        {
          id: '1',
          type: 'PHOTO',
          category: 'PROGRESS',
          status: 'ACTIVE',
          priority: 'HIGH',
          title: 'Kitchen Electrical Progress',
          description: 'Rough electrical installation complete in kitchen area. All outlets installed according to plan.',
          location: 'Kitchen',
          author: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image },
          room: project.rooms.find((r: any) => r.type === 'KITCHEN'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          photos: [],
          tasks: [],
          documents: [],
          messages: [],
          _count: {
            photos: 3,
            tasks: 1,
            documents: 0,
            messages: 2
          }
        }
      ]

      // Mock photos
      photos = [
        {
          id: '1',
          asset: {
            id: 'asset1',
            title: 'Kitchen Electrical Outlets',
            filename: 'kitchen-electrical.jpg',
            url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
            type: 'IMAGE',
            size: 2048000,
            mimeType: 'image/jpeg',
            uploader: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image },
            createdAt: new Date().toISOString()
          },
          caption: 'All kitchen outlets installed and tested',
          gpsCoordinates: { lat: 40.7128, lng: -74.0060 },
          takenAt: new Date().toISOString(),
          tags: ['electrical', 'kitchen', 'progress'],
          roomArea: 'Kitchen',
          tradeCategory: 'electrical',
          isBeforePhoto: false,
          isAfterPhoto: false,
          aiAnalysis: {
            detectedObjects: ['electrical_outlet', 'wall', 'kitchen_cabinet'],
            suggestedTags: ['electrical', 'installation'],
            roomType: 'kitchen',
            tradeCategory: 'electrical',
            qualityScore: 0.92,
            issues: []
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          asset: {
            id: 'asset2',
            title: 'Master Bathroom Before',
            filename: 'master-bath-before.jpg',
            url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800',
            type: 'IMAGE',
            size: 1852000,
            mimeType: 'image/jpeg',
            uploader: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image },
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          caption: 'Master bathroom before renovation',
          takenAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          tags: ['bathroom', 'before', 'renovation'],
          roomArea: 'Master Bathroom',
          tradeCategory: 'general',
          isBeforePhoto: true,
          isAfterPhoto: false,
          pairedPhoto: {
            id: '3',
            asset: {
              id: 'asset3',
              title: 'Master Bathroom After',
              url: 'https://images.unsplash.com/photo-1564540583246-934409427776?w=800',
              type: 'IMAGE'
            }
          },
          aiAnalysis: {
            detectedObjects: ['bathroom', 'toilet', 'vanity'],
            suggestedTags: ['bathroom', 'before'],
            roomType: 'bathroom',
            tradeCategory: 'general',
            qualityScore: 0.88,
            issues: []
          },
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      // Mock tasks
      tasks = [
        {
          id: '1',
          title: 'Install kitchen island electrical',
          description: 'Install GFCI outlets and under-cabinet lighting for kitchen island',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          tradeType: 'electrical',
          estimatedHours: 6,
          actualHours: 4,
          estimatedCost: 450,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          dependencies: [],
          assignee: project.organization.users[0],
          contractor: project.projectContractors[0]?.contractor,
          createdBy: { id: session.user.id, name: session.user.name, email: session.user.email },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { messages: 3, attachments: 1 }
        },
        {
          id: '2',
          title: 'Master bathroom plumbing inspection',
          description: 'Schedule and complete rough plumbing inspection',
          status: 'TODO',
          priority: 'URGENT',
          tradeType: 'plumbing',
          estimatedHours: 2,
          estimatedCost: 150,
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          dependencies: [],
          contractor: project.projectContractors.find((pc: any) => pc.contractor.specialty === 'Plumbing')?.contractor,
          createdBy: { id: session.user.id, name: session.user.name, email: session.user.email },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { messages: 1, attachments: 0 }
        }
      ]

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