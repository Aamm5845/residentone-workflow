import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractors = await prisma.contractor.findMany({
      where: { orgId: session.user.orgId, isActive: true },
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
    const { businessName, contactName, email, phone, address, type, specialty } = data

    if (!businessName || !email) {
      return NextResponse.json({ error: 'Business name and email are required' }, { status: 400 })
    }

    if (type === 'subcontractor' && !specialty) {
      return NextResponse.json({ error: 'Specialty is required for subcontractors' }, { status: 400 })
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
        orgId: session.user.orgId
      }
    })

    return NextResponse.json(contractor, { status: 201 })
  } catch (error) {
    console.error('Error creating contractor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
