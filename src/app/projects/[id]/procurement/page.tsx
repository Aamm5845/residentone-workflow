import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProcurementContent from './components/ProcurementContent'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProjectProcurement({ params, searchParams }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params
  const { tab } = await searchParams

  // Fetch project with client info
  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      }
    }
  })

  if (!project) {
    redirect('/projects')
  }

  return (
    <DashboardLayout session={session}>
      <ProcurementContent
        project={project}
        initialTab={tab || 'inbox'}
      />
    </DashboardLayout>
  )
}
