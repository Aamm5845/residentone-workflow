import { getSession } from '@/lib/auth'
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
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Only allow OWNER and ADMIN to access project settings
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
    redirect('/projects')
  }

  const { id } = await params

  // Fetch project with full details
  let project: any = null
  let clients: any[] = []
  
  try {
    [project, clients] = await Promise.all([
      prisma.project.findFirst({
        where: { 
          id: id,
          orgId: session.user.orgId
        },
        include: {
          client: true,
          createdBy: {
            select: { id: true, name: true, email: true }
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
        where: { orgId: session.user.orgId },
        orderBy: { name: 'asc' }
      })
    ])
  } catch (error) {
    console.error('Error fetching project or clients:', error)
    redirect('/projects')
  }

  if (!project) {
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
            
            {/* Project Title & Info */}
            <div className="mt-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Project Settings
              </h1>
              <p className="text-gray-600">
                Manage project information, cover image, Dropbox location, and other settings
              </p>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8">
              <ProjectSettingsForm 
                project={project}
                clients={clients}
                session={session}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}