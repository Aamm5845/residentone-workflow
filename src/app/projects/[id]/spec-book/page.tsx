import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, BookOpen, FileText, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function SpecBookPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project to verify it exists and has the feature enabled
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id
      },
      select: {
        id: true,
        name: true,
        hasSpecBook: true,
        client: {
          select: {
            id: true,
            name: true
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

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
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
            </div>
            
            {/* Page Title */}
            <div className="mt-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Spec Book</h1>
                  <p className="text-gray-600 mt-1">{project.name} • {project.client.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-12 h-12 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Spec Book Feature Coming Soon
              </h2>
              
              <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
                We're building a comprehensive spec book management system that will help you organize and share all project specifications, materials, and technical documents with your clients.
              </p>

              {/* Feature Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Spec Documents</h3>
                  <p className="text-gray-600 text-sm">
                    Organize all specification documents, material lists, and product catalogs in one place.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">PDF Generation</h3>
                  <p className="text-gray-600 text-sm">
                    Generate professional PDF spec books with your branding for client presentations.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ExternalLink className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">CAD File Links</h3>
                  <p className="text-gray-600 text-sm">
                    Link CAD files and technical drawings directly to specifications for easy access.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-500 mb-6">
                  This feature is currently in development. We'll notify you when it's ready to use.
                </p>
                
                <Link href={`/projects/${project.id}`}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    Return to Project
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}