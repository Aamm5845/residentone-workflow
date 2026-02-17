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

  if (query.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const orgId = session.user.orgId

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
        ],
      },
      select: { id: true, businessName: true, contactName: true, email: true, type: true },
      take: 10,
    }),
  ])

  // Normalize results into a unified format
  const results = [
    ...users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      type: 'TEAM_MEMBER' as const,
      subtitle: 'Team Member',
    })),
    ...clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      type: 'CLIENT' as const,
      subtitle: c.company ? `Client - ${c.company}` : 'Client',
    })),
    ...contractors.map((c) => ({
      id: c.id,
      name: c.contactName || c.businessName,
      email: c.email,
      type: c.type === 'SUBCONTRACTOR' ? ('SUBCONTRACTOR' as const) : ('CONTRACTOR' as const),
      subtitle: c.type === 'SUBCONTRACTOR' ? `Sub - ${c.businessName}` : `Contractor - ${c.businessName}`,
    })),
  ]

  return NextResponse.json({ results })
}
