import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Combined recipient list: client + project contractors + previous recipients
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: {
        id: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
          },
        },
        projectContractors: {
          where: { isActive: true },
          select: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                contactName: true,
                email: true,
                type: true,
                trade: true,
                specialty: true,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const recipients: Array<{
      id: string
      name: string
      email: string
      company: string | null
      type: string
      trade: string | null
    }> = []

    // Add client
    if (project.client) {
      recipients.push({
        id: project.client.id,
        name: project.client.name,
        email: project.client.email,
        company: project.client.company,
        type: 'CLIENT',
        trade: null,
      })
    }

    // Add contractors
    for (const pc of project.projectContractors) {
      const c = pc.contractor
      recipients.push({
        id: c.id,
        name: c.contactName || c.businessName,
        email: c.email,
        company: c.businessName,
        type: c.type === 'SUBCONTRACTOR' ? 'SUBCONTRACTOR' : 'CONTRACTOR',
        trade: c.trade,
      })
    }

    // Add previous recipients from transmittals (deduplicated)
    const previousRecipients = await prisma.transmittal.findMany({
      where: { projectId: id, status: 'SENT', recipientEmail: { not: null } },
      distinct: ['recipientEmail'],
      select: {
        recipientName: true,
        recipientEmail: true,
        recipientCompany: true,
        recipientType: true,
      },
    })

    const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()))
    for (const prev of previousRecipients) {
      if (prev.recipientEmail && !existingEmails.has(prev.recipientEmail.toLowerCase())) {
        recipients.push({
          id: `prev-${prev.recipientEmail}`,
          name: prev.recipientName,
          email: prev.recipientEmail,
          company: prev.recipientCompany,
          type: prev.recipientType || 'OTHER',
          trade: null,
        })
      }
    }

    return NextResponse.json(recipients)
  } catch (error) {
    console.error('[project-files-v3/recipients] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    )
  }
}
