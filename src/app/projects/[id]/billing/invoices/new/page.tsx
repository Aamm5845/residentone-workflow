import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InvoiceForm from '@/components/billing/invoices/InvoiceForm'

interface Props {
  params: { id: string }
  searchParams: { proposalId?: string; fromUnbilled?: string }
}

export default async function NewInvoicePage({ params, searchParams }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id: projectId } = await params
  const { proposalId, fromUnbilled } = await searchParams || {}

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

  // Get project with client info including billing information
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          // Billing information
          billingName: true,
          billingEmail: true,
          billingAddress: true,
          billingCity: true,
          billingProvince: true,
          billingPostalCode: true,
          billingCountry: true,
        },
      },
    },
  })

  if (!project) {
    redirect('/projects')
  }

  // Get organization settings for default tax rates
  const org = await prisma.organization.findFirst({
    where: { id: currentUser.orgId },
    select: {
      defaultGstRate: true,
      defaultQstRate: true,
    },
  })

  // Get proposal data - either from URL parameter or find the signed proposal for this project
  let proposal = null
  if (proposalId) {
    // Explicit proposal ID provided
    proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        projectId,
        orgId: currentUser.orgId,
      },
      select: {
        id: true,
        proposalNumber: true,
        title: true,
        billingType: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        clientAddress: true,
        subtotal: true,
        totalAmount: true,
        gstRate: true,
        qstRate: true,
        hourlyRate: true,
        depositAmount: true,
        ccFeePercent: true,
        paymentSchedule: true,
      },
    })
  } else {
    // No proposal ID - automatically find the signed proposal for this project
    proposal = await prisma.proposal.findFirst({
      where: {
        projectId,
        orgId: currentUser.orgId,
        status: 'SIGNED',
      },
      orderBy: { signedAt: 'desc' }, // Most recently signed
      select: {
        id: true,
        proposalNumber: true,
        title: true,
        billingType: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        clientAddress: true,
        subtotal: true,
        totalAmount: true,
        gstRate: true,
        qstRate: true,
        hourlyRate: true,
        depositAmount: true,
        ccFeePercent: true,
        paymentSchedule: true,
      },
    })
  }

  return (
    <DashboardLayout session={session}>
      <InvoiceForm
        projectId={project.id}
        projectName={project.name}
        client={project.client}
        autoOpenTimeSelector={fromUnbilled === 'true'}
        defaultGstRate={org?.defaultGstRate ? Number(org.defaultGstRate) : 5}
        defaultQstRate={org?.defaultQstRate ? Number(org.defaultQstRate) : 9.975}
        fromProposal={proposal ? {
          id: proposal.id,
          number: proposal.proposalNumber,
          title: proposal.title,
          billingType: proposal.billingType,
          clientName: proposal.clientName,
          clientEmail: proposal.clientEmail,
          clientPhone: proposal.clientPhone,
          clientAddress: proposal.clientAddress,
          subtotal: Number(proposal.subtotal),
          totalAmount: Number(proposal.totalAmount),
          gstRate: proposal.gstRate ? Number(proposal.gstRate) : undefined,
          qstRate: proposal.qstRate ? Number(proposal.qstRate) : undefined,
          hourlyRate: proposal.hourlyRate ? Number(proposal.hourlyRate) : undefined,
          depositAmount: proposal.depositAmount ? Number(proposal.depositAmount) : undefined,
          ccFeePercent: proposal.ccFeePercent ? Number(proposal.ccFeePercent) : 3,
          paymentSchedule: proposal.paymentSchedule as any[] || [],
        } : undefined}
      />
    </DashboardLayout>
  )
}
