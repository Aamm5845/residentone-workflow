import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Return combined recipient list for transmittals
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

    // Verify project access and get client info
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: {
        id: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Use a Map keyed by email (lowercased) for deduplication
    const recipientMap = new Map<
      string,
      { name: string; email: string; company: string | null; type: string }
    >()

    // 1. Project client
    if (project.client?.email) {
      const key = project.client.email.toLowerCase()
      recipientMap.set(key, {
        name: project.client.name,
        email: project.client.email,
        company: project.client.company || null,
        type: 'CLIENT'
      })
    }

    // 2. Project contractors
    try {
      const projectContractors = await prisma.projectContractor.findMany({
        where: { projectId: id, isActive: true },
        include: {
          contractor: {
            select: {
              id: true,
              businessName: true,
              contactName: true,
              email: true
            }
          }
        }
      })

      for (const pc of projectContractors) {
        const contractor = pc.contractor
        if (contractor.email) {
          const key = contractor.email.toLowerCase()
          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              name: contractor.contactName || contractor.businessName,
              email: contractor.email,
              company: contractor.businessName,
              type: 'CONTRACTOR'
            })
          }
        }
      }
    } catch (err) {
      // ProjectContractor table might not exist - continue gracefully
      console.warn('[project-files-v2/recipients] Could not fetch contractors:', err)
    }

    // 3. Previous unique recipients from transmittals for this project
    try {
      const previousTransmittals = await prisma.transmittal.findMany({
        where: { projectId: id },
        select: {
          recipientName: true,
          recipientEmail: true,
          recipientCompany: true,
          recipientType: true
        },
        distinct: ['recipientEmail']
      })

      for (const t of previousTransmittals) {
        if (t.recipientEmail) {
          const key = t.recipientEmail.toLowerCase()
          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              name: t.recipientName,
              email: t.recipientEmail,
              company: t.recipientCompany || null,
              type: t.recipientType || 'OTHER'
            })
          }
        }
      }
    } catch (err) {
      console.warn('[project-files-v2/recipients] Could not fetch previous transmittals:', err)
    }

    const recipients = Array.from(recipientMap.values())

    return NextResponse.json(recipients)
  } catch (error) {
    console.error('[project-files-v2/recipients] Error fetching recipients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    )
  }
}
