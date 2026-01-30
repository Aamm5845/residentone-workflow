import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProposalForm from '@/components/billing/proposals/ProposalForm'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ai?: string }>
}

export default async function NewProposalPage({ params, searchParams }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id: projectId } = await params
  const resolvedSearchParams = await searchParams
  const showAI = resolvedSearchParams?.ai === 'true'

  // Check billing permission
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, canSeeBilling: true, orgId: true },
  })

  if (!currentUser) {
    redirect('/projects')
  }

  const hasAccess = currentUser.role === 'OWNER' || currentUser.canSeeBilling

  if (!hasAccess) {
    redirect(`/projects/${projectId}`)
  }

  // Get project with client info
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      address: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      rooms: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  })

  if (!project) {
    redirect('/projects')
  }

  // Get organization settings for default tax rates
  const org = currentUser.orgId ? await prisma.organization.findFirst({
    where: { id: currentUser.orgId },
    select: {
      defaultGstRate: true,
      defaultQstRate: true,
    },
  }) : null

  return (
    <DashboardLayout session={session as any}>
      <ProposalForm
        projectId={project.id}
        projectName={project.name}
        projectType={project.type || 'Interior Design'}
        projectAddress={project.address || undefined}
        client={project.client || { id: '', name: 'No Client', email: '', phone: null }}
        defaultGstRate={org?.defaultGstRate ? Number(org.defaultGstRate) : 5}
        defaultQstRate={org?.defaultQstRate ? Number(org.defaultQstRate) : 9.975}
        showAIGenerator={showAI}
      />
    </DashboardLayout>
  )
}
