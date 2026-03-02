import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity, getIPAddress } from '@/lib/attribution'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractors = await prisma.contractor.findMany({
      where: { orgId: session.user.orgId, isActive: true },
      include: { contacts: true },
      orderBy: { businessName: 'asc' }
    })

    return NextResponse.json(contractors)
  } catch (error) {
    console.error('Error fetching contractors:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { businessName, contactName, email, phone, address, type, specialty, trade, logoUrl, contacts } = data

    if (!businessName || !email) {
      return NextResponse.json({ error: 'Business name and email are required' }, { status: 400 })
    }

    if (type === 'subcontractor' && !specialty && !trade) {
      return NextResponse.json({ error: 'Specialty or trade is required for subcontractors' }, { status: 400 })
    }

    // Check if contractor already exists
    const existing = await prisma.contractor.findFirst({
      where: {
        orgId: session.user.orgId,
        email: email
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Contractor with this email already exists' }, { status: 400 })
    }

    const contractor = await prisma.contractor.create({
      data: {
        businessName,
        contactName: contactName || null,
        email,
        phone: phone || null,
        address: address || null,
        type: type || 'CONTRACTOR',
        specialty: specialty || null,
        trade: trade || null,
        logoUrl: logoUrl || null,
        orgId: session.user.orgId,
        ...(contacts && contacts.length > 0 ? {
          contacts: {
            create: contacts.map((c: any) => ({
              name: c.name,
              email: c.email,
              phone: c.phone || null,
              role: c.role || null,
              isPrimary: c.isPrimary || false,
            }))
          }
        } : {})
      },
      include: { contacts: true }
    })

    await logActivity({
      session: { user: { id: session.user.id, orgId: (session.user as any).orgId, role: (session.user as any).role || 'USER' } } as any,
      action: 'CONTRACTOR_CREATED',
      entity: 'Contractor',
      entityId: contractor.id,
      details: { contractorName: contractor.businessName, companyName: contractor.businessName },
      ipAddress: getIPAddress(request)
    })

    return NextResponse.json(contractor, { status: 201 })
  } catch (error) {
    console.error('Error creating contractor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
