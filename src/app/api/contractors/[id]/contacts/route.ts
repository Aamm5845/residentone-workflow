import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

interface Props {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify contractor belongs to org
    const contractor = await prisma.contractor.findFirst({
      where: { id, orgId: session.user.orgId }
    })

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    const contacts = await prisma.contractorContact.findMany({
      where: { contractorId: id },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
    })

    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching contractor contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()
    const { name, email, phone, role, isPrimary } = data

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    // Verify contractor belongs to org
    const contractor = await prisma.contractor.findFirst({
      where: { id, orgId: session.user.orgId }
    })

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    const contact = await prisma.contractorContact.create({
      data: {
        contractorId: id,
        name,
        email,
        phone: phone || null,
        role: role || null,
        isPrimary: isPrimary || false,
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating contractor contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
