import { getSession } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProposalForm from '@/components/billing/proposals/ProposalForm'

interface Props {
  params: Promise<{ id: string; proposalId: string }>
}

export default async function EditProposalPage({ params }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id: projectId, proposalId } = await params

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

  // Get proposal with all details
  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      projectId,
      orgId: currentUser.orgId,
    },
  })

  if (!proposal) {
    notFound()
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

  // Format proposal for the form
  const existingProposal = {
    id: proposal.id,
    proposalNumber: proposal.proposalNumber,
    title: proposal.title,
    billingType: proposal.billingType,
    content: proposal.content as any,
    coverLetter: proposal.coverLetter,
    paymentSchedule: proposal.paymentSchedule as any[],
    clientName: proposal.clientName,
    clientEmail: proposal.clientEmail,
    clientPhone: proposal.clientPhone,
    clientAddress: proposal.clientAddress,
    projectAddress: proposal.projectAddress,
    subtotal: Number(proposal.subtotal),
    depositAmount: proposal.depositAmount ? Number(proposal.depositAmount) : null,
    depositPercent: proposal.depositPercent ? Number(proposal.depositPercent) : null,
    hourlyRate: proposal.hourlyRate ? Number(proposal.hourlyRate) : null,
    discountPercent: proposal.discountPercent ? Number(proposal.discountPercent) : null,
    discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
    gstRate: proposal.gstRate ? Number(proposal.gstRate) : null,
    qstRate: proposal.qstRate ? Number(proposal.qstRate) : null,
    ccFeePercent: proposal.ccFeePercent ? Number(proposal.ccFeePercent) : 3.5,
    totalAmount: Number(proposal.totalAmount),
    validUntil: proposal.validUntil ? proposal.validUntil.toISOString().split('T')[0] : null,
    validDays: proposal.validDays,
    notes: proposal.notes,
    companySignature: proposal.companySignature,
    companySignedByName: proposal.companySignedByName,
  }

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
        existingProposal={existingProposal}
      />
    </DashboardLayout>
  )
}
