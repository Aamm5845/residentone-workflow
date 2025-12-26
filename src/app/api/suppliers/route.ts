import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/suppliers
 * Get all suppliers for the organization
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    const suppliers = await prisma.supplier.findMany({
      where: {
        orgId,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, contactName, logo, phone, email, emails, category, categoryId, address, website, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }
    
    if (!contactName) {
      return NextResponse.json({ error: 'Contact name is required' }, { status: 400 })
    }
    
    if (!email) {
      return NextResponse.json({ error: 'Contact email is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const supplier = await prisma.supplier.create({
      data: {
        orgId,
        name,
        contactName: contactName || null,
        logo: logo || null,
        phone: phone || null,
        email,
        emails: emails || null,
        category: category || null,
        categoryId: categoryId || null,
        address: address || null,
        website: website || null,
        notes: notes || null,
        createdById: userId
      }
    })

    return NextResponse.json({ supplier })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/suppliers
 * Update a supplier
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, contactName, logo, phone, email, emails, category, categoryId, address, website, notes, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Verify supplier belongs to org
    const existing = await prisma.supplier.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactName !== undefined && { contactName }),
        ...(logo !== undefined && { logo }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(emails !== undefined && { emails }),
        ...(category !== undefined && { category }),
        ...(categoryId !== undefined && { categoryId }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json({ supplier })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers
 * Delete a supplier (soft delete by setting isActive to false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId

    // Verify supplier belongs to org
    const existing = await prisma.supplier.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}

