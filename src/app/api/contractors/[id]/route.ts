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

    const contractor = await prisma.contractor.findFirst({
      where: { 
        id,
        orgId: session.user.orgId 
      },
      include: {
        projectContractors: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    return NextResponse.json(contractor)
  } catch (error) {
    console.error('Error fetching contractor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()
    const { businessName, contactName, email, phone, address, type, specialty, notes, isActive } = data

    if (!businessName || !email) {
      return NextResponse.json({ error: 'Business name and email are required' }, { status: 400 })
    }

    if (type === 'SUBCONTRACTOR' && !specialty) {
      return NextResponse.json({ error: 'Specialty is required for subcontractors' }, { status: 400 })
    }

    // Check if contractor exists and belongs to the organization
    const existingContractor = await prisma.contractor.findFirst({
      where: { 
        id,
        orgId: session.user.orgId 
      }
    })

    if (!existingContractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    // Check if email is already used by another contractor
    if (email !== existingContractor.email) {
      const emailExists = await prisma.contractor.findFirst({
        where: {
          orgId: session.user.orgId,
          email: email,
          id: { not: id }
        }
      })

      if (emailExists) {
        return NextResponse.json({ error: 'Email is already used by another contractor' }, { status: 400 })
      }
    }

    const contractor = await prisma.contractor.update({
      where: { id },
      data: {
        businessName,
        contactName: contactName || null,
        email,
        phone: phone || null,
        address: address || null,
        type: type || 'CONTRACTOR',
        specialty: specialty || null,
        notes: notes || null,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json(contractor)
  } catch (error) {
    console.error('Error updating contractor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if contractor exists and belongs to the organization
    const existingContractor = await prisma.contractor.findFirst({
      where: { 
        id,
        orgId: session.user.orgId 
      },
      include: {
        projectContractors: true
      }
    })

    if (!existingContractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    // Check if contractor is used in any projects
    if (existingContractor.projectContractors.length > 0) {
      // Instead of hard delete, soft delete by setting isActive to false
      const contractor = await prisma.contractor.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ 
        message: 'Contractor deactivated (used in projects)', 
        contractor 
      })
    }

    // Hard delete if not used in any projects
    await prisma.contractor.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Contractor deleted successfully' })
  } catch (error) {
    console.error('Error deleting contractor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}