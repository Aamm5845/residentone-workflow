import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/meetings/attendees/search?q=john
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const projectId = searchParams.get('projectId') || ''

  if (query.length < 1 && !projectId) {
    return NextResponse.json({ results: [] })
  }

  const orgId = session.user.orgId

  // If a project is selected, first get the project's contacts (client + assigned contractors)
  let projectResults: any[] = []
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: {
        clientId: true,
        client: { select: { id: true, name: true, email: true, company: true } },
        projectContractors: {
          where: { isActive: true },
          include: {
            contractor: {
              select: { id: true, businessName: true, contactName: true, email: true, type: true, contacts: true },
            },
          },
        },
      },
    })

    if (project) {
      // Add project client
      if (project.client) {
        const c = project.client
        const matchesQuery = !query || [c.name, c.email, c.company].some(
          (v) => v && v.toLowerCase().includes(query.toLowerCase())
        )
        if (matchesQuery) {
          projectResults.push({
            id: c.id,
            name: c.name,
            email: c.email,
            type: 'CLIENT' as const,
            subtitle: c.company ? `Client - ${c.company}` : 'Client',
            isProjectContact: true,
          })
        }
      }

      // Add project contractors/subs — include each contact as a separate entry
      for (const pc of project.projectContractors) {
        const c = pc.contractor
        const contractorType = c.type === 'SUBCONTRACTOR' ? ('SUBCONTRACTOR' as const) : ('CONTRACTOR' as const)
        const subtitlePrefix = c.type === 'SUBCONTRACTOR' ? 'Sub' : 'Contractor'

        if (c.contacts && c.contacts.length > 0) {
          // Show each contact as a selectable person
          for (const contact of c.contacts) {
            const matchesQuery = !query || [contact.name, contact.email, c.businessName].some(
              (v) => v && v.toLowerCase().includes(query.toLowerCase())
            )
            if (matchesQuery) {
              projectResults.push({
                id: c.id,
                name: contact.name,
                email: contact.email,
                type: contractorType,
                subtitle: `${subtitlePrefix} - ${c.businessName}${contact.role ? ` (${contact.role})` : ''}`,
                isProjectContact: true,
              })
            }
          }
        } else {
          // Fallback to legacy contactName/email
          const matchesQuery = !query || [c.businessName, c.contactName, c.email].some(
            (v) => v && v.toLowerCase().includes(query.toLowerCase())
          )
          if (matchesQuery) {
            projectResults.push({
              id: c.id,
              name: c.contactName || c.businessName,
              email: c.email,
              type: contractorType,
              subtitle: `${subtitlePrefix} - ${c.businessName}`,
              isProjectContact: true,
            })
          }
        }
      }
    }
  }

  // If no search query, return just project contacts
  if (query.length < 1) {
    return NextResponse.json({ results: projectResults })
  }

  // Search across Users, Clients, and Contractors in parallel
  const [users, clients, contractors] = await Promise.all([
    // Team members
    prisma.user.findMany({
      where: {
        orgId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    }),
    // Clients
    prisma.client.findMany({
      where: {
        orgId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, company: true },
      take: 10,
    }),
    // Contractors & Subcontractors
    prisma.contractor.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [
          { businessName: { contains: query, mode: 'insensitive' } },
          { contactName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { contacts: { some: { name: { contains: query, mode: 'insensitive' } } } },
          { contacts: { some: { email: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      select: { id: true, businessName: true, contactName: true, email: true, type: true, contacts: true },
      take: 10,
    }),
  ])

  // Collect IDs of project contacts to avoid duplicates
  const projectContactIds = new Set(projectResults.map((r) => r.id))

  // Normalize org-wide results, excluding project contacts already included
  const orgResults = [
    ...users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      type: 'TEAM_MEMBER' as const,
      subtitle: 'Team Member',
    })),
    ...clients.filter((c) => !projectContactIds.has(c.id)).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      type: 'CLIENT' as const,
      subtitle: c.company ? `Client - ${c.company}` : 'Client',
    })),
    ...contractors.filter((c) => !projectContactIds.has(c.id)).flatMap((c) => {
      const contractorType = c.type === 'SUBCONTRACTOR' ? ('SUBCONTRACTOR' as const) : ('CONTRACTOR' as const)
      const subtitlePrefix = c.type === 'SUBCONTRACTOR' ? 'Sub' : 'Contractor'

      if (c.contacts && c.contacts.length > 0) {
        return c.contacts.map((contact: any) => ({
          id: c.id,
          name: contact.name,
          email: contact.email,
          type: contractorType,
          subtitle: `${subtitlePrefix} - ${c.businessName}${contact.role ? ` (${contact.role})` : ''}`,
        }))
      }
      return [{
        id: c.id,
        name: c.contactName || c.businessName,
        email: c.email,
        type: contractorType,
        subtitle: `${subtitlePrefix} - ${c.businessName}`,
      }]
    }),
  ]

  // Project contacts first, then org-wide results
  return NextResponse.json({ results: [...projectResults, ...orgResults] })
}
