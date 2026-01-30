import { getSession } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InvoicePreviewClient from './InvoicePreviewClient'

interface Props {
  params: Promise<{ id: string; invoiceId: string }>
}

export default async function InvoicePreviewPage({ params }: Props) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id: projectId, invoiceId } = await params

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

  // Get invoice with all details
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      projectId,
      orgId: currentUser.orgId,
    },
    include: {
      lineItems: {
        orderBy: { order: 'asc' },
      },
      project: {
        select: { name: true },
      },
    },
  })

  if (!invoice) {
    notFound()
  }

  // Get organization info
  const org = await prisma.organization.findFirst({
    where: { id: currentUser.orgId },
    select: {
      name: true,
      businessName: true,
      businessEmail: true,
      businessPhone: true,
      businessAddress: true,
      businessCity: true,
      businessProvince: true,
      businessPostal: true,
      gstNumber: true,
      qstNumber: true,
    },
  })

  return (
    <DashboardLayout session={session as any}>
      <InvoicePreviewClient
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          title: invoice.title,
          description: invoice.description,
          status: invoice.status,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientPhone: invoice.clientPhone,
          clientAddress: invoice.clientAddress,
          lineItems: invoice.lineItems.map(item => ({
            id: item.id,
            type: item.type,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
          })),
          subtotal: Number(invoice.subtotal),
          discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : null,
          discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : null,
          gstRate: invoice.gstRate ? Number(invoice.gstRate) : null,
          gstAmount: invoice.gstAmount ? Number(invoice.gstAmount) : null,
          qstRate: invoice.qstRate ? Number(invoice.qstRate) : null,
          qstAmount: invoice.qstAmount ? Number(invoice.qstAmount) : null,
          totalAmount: Number(invoice.totalAmount),
          dueDate: invoice.dueDate?.toISOString().split('T')[0] || null,
          notes: invoice.notes,
          allowCreditCard: invoice.allowCreditCard,
          ccFeePercent: invoice.ccFeePercent ? Number(invoice.ccFeePercent) : 3.5,
        }}
        projectId={projectId}
        projectName={invoice.project.name}
        organization={org}
      />
    </DashboardLayout>
  )
}
