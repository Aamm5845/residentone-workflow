import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/extension/suppliers
 * Get all suppliers for the organization (for extension)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        orgId: user.orgId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        website: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ ok: true, suppliers })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/extension/suppliers
 * Create a new supplier in the phonebook
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    const body = await request.json()
    const { name, contactName, email, phone, website } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    // Check if supplier with same name already exists
    const existing = await prisma.supplier.findFirst({
      where: {
        orgId: user.orgId,
        name: { equals: name.trim(), mode: 'insensitive' }
      }
    })

    if (existing) {
      return NextResponse.json({
        error: 'A supplier with this name already exists',
        supplier: existing
      }, { status: 409 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        orgId: user.orgId,
        name: name.trim(),
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        website: true
      }
    })

    return NextResponse.json({ ok: true, supplier })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}


