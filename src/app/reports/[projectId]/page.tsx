import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ProjectReportContent } from '@/components/reports/ProjectReportContent'
import type { Session } from 'next-auth'

export default async function ProjectReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    return redirect('/auth/signin')
  }

  const resolvedParams = await params
  const { projectId } = resolvedParams

  return (
    <DashboardLayout session={session}>
      <ProjectReportContent projectId={projectId} />
    </DashboardLayout>
  )
}
