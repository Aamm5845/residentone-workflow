import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import BillingPageClient from './BillingPageClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectBillingPage({ params }: PageProps) {
  const { id: projectId } = await params
  const session = await getSession()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Check billing access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, canSeeBilling: true },
  })

  if (user?.role !== 'OWNER' && !user?.canSeeBilling) {
    redirect(`/projects/${projectId}`)
  }

  // Get project with client info
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      orgId: session.user.orgId || undefined,
    },
    include: {
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
    notFound()
  }

  // Get organization settings
  const org = session.user.orgId ? await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: {
      name: true,
      defaultGstRate: true,
      defaultQstRate: true,
      businessName: true,
      businessEmail: true,
      businessPhone: true,
      businessAddress: true,
      businessCity: true,
      businessProvince: true,
      businessPostal: true,
      wireInstructions: true,
      etransferEmail: true,
    },
  }) : null

  return (
    <DashboardLayout session={session as any}>
      <Suspense fallback={<div className="p-8 text-center">Loading billing...</div>}>
        <BillingPageClient
          projectId={project.id}
          projectName={project.name}
          projectType={project.type || 'Interior Design'}
          projectAddress={project.address || undefined}
          client={project.client ? {
            id: project.client.id,
            name: project.client.name,
            email: project.client.email || '',
            phone: project.client.phone,
          } : {
            id: '',
            name: 'No Client',
            email: '',
            phone: null,
          }}
          defaultGstRate={org?.defaultGstRate ? Number(org.defaultGstRate) : 5}
          defaultQstRate={org?.defaultQstRate ? Number(org.defaultQstRate) : 9.975}
          organization={org ? {
            name: org.name,
            businessName: org.businessName || undefined,
            businessEmail: org.businessEmail || undefined,
            businessPhone: org.businessPhone || undefined,
            businessAddress: org.businessAddress || undefined,
            businessCity: org.businessCity || undefined,
            businessProvince: org.businessProvince || undefined,
            businessPostal: org.businessPostal || undefined,
            wireInstructions: org.wireInstructions || undefined,
            etransferEmail: org.etransferEmail || undefined,
          } : null}
        />
      </Suspense>
    </DashboardLayout>
  )
}
