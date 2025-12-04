import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ProjectSettingsForm from '@/components/projects/project-settings-form'
import type { Session } from 'next-auth'

interface Props {
  params: { id: string }
}

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

export default async function ProjectSettings({ params }: Props) {
  const session = await getSession() as AuthSession | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Fetch project with full details
  let project: any = null
  let clients: any[] = []
  
  try {
    const results = await Promise.all([
      prisma.project.findFirst({
        where: { 
          id: id
        },
        include: {
          client: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          projectContractors: {
            where: { isActive: true },
            include: {
              contractor: true
            }
          },
          _count: {
            select: { 
              rooms: true,
              assets: true,
              approvals: true,
              comments: true
            }
          }
        }
      }),
      prisma.client.findMany({
        orderBy: { name: 'asc' }
      })
    ])
    
    // Assign results to variables
    project = results[0]
    clients = results[1]
    
    // Transform projectContractors to the format expected by the form
    if (project && project.projectContractors) {
      project.contractors = project.projectContractors.map((pc: any) => ({
        id: pc.contractor.id,
        businessName: pc.contractor.businessName,
        contactName: pc.contractor.contactName,
        email: pc.contractor.email,
        phone: pc.contractor.phone,
        address: pc.contractor.address,
        type: pc.contractor.type?.toLowerCase() || pc.role?.toLowerCase() || 'contractor',
        specialty: pc.contractor.specialty
      }))
    } else if (project) {
      project.contractors = []
    }
    
    // Ensure coverImages is properly serialized
    if (project && project.coverImages) {
      // Prisma returns Json fields as actual types, ensure it's an array
      if (typeof project.coverImages === 'string') {
        try {
          project.coverImages = JSON.parse(project.coverImages)
        } catch {
          project.coverImages = [project.coverImages]
        }
      } else if (!Array.isArray(project.coverImages)) {
        project.coverImages = []
      }
    } else if (project) {
      project.coverImages = []
    }
    
  } catch (error) {
    console.error('[ProjectSettings] Error fetching project or clients:', error)
    console.error('[ProjectSettings] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    // Instead of silently redirecting, show an error page with more info
    return (
      <DashboardLayout session={session}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-sm p-8 max-w-md text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to load project settings</h1>
            <p className="text-gray-600 mb-4">There was an error loading the project. This might be a temporary issue.</p>
            <p className="text-sm text-red-600 mb-4">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href={`/projects/${id}`} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Back to Project
            </a>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    console.error('[ProjectSettings] Project not found for id:', id)
    redirect('/projects')
  }

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/projects/${id}`}>
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Project
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Project Title */}
            <div className="mt-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                {project.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Settings Form with Sidebar */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <ProjectSettingsForm 
            project={project}
            clients={clients}
            session={session}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}