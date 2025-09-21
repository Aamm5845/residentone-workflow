import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import NewProjectForm from '@/components/projects/new-project-form'
import type { Session } from 'next-auth'

export default async function NewProject() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      name: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
            <p className="text-gray-600 mt-1">
              Set up a new interior design project with rooms and team assignments
            </p>
          </div>

          {/* Form */}
          <NewProjectForm session={session} />
        </div>
      </div>
    </DashboardLayout>
  )
}
